import { Job } from 'bullmq';
import { db } from '@/lib/db/drizzle';
import { productVariants, products, inventoryTransactions } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Processor to handle inventory operations queue.
 * Handles reserving stock when order is placed, 
 * delivering stock when order is fulfilled,
 * and cancelling reservations if order fails/is returned.
 */
export default async function inventoryProcessor(job: Job) {
  const { items } = job.data as { items: Array<{ productId: string; variantId: string | null; quantity: number }> };

  for (const item of items) {
    if (job.name === 'reserveStock') {
      if (item.variantId) {
        // Fetch variant inventory and product trackQuantity flag
        const result = await db.select({
          inventory: productVariants.inventoryQuantity,
          reserved: productVariants.reservedStock,
          track: products.trackQuantity,
        })
          .from(productVariants)
          .innerJoin(products, eq(productVariants.productId, products.id))
          .where(eq(productVariants.id, item.variantId))
          .limit(1);

        const record = result[0];
        if (record && record.track) {
          const newQty = record.inventory - item.quantity;
          const newReserved = record.reserved + item.quantity;
          await db.update(productVariants)
            .set({
              inventoryQuantity: newQty > 0 ? newQty : 0,
              reservedStock: newReserved > 0 ? newReserved : 0
            })
            .where(eq(productVariants.id, item.variantId));
        }
      } else {
        const prodRes = await db.select({
          inventory: products.stock,
          reserved: products.reservedStock,
          track: products.trackQuantity,
        })
          .from(products)
          .where(eq(products.id, item.productId))
          .limit(1);

        const prodRec = prodRes[0];
        if (prodRec && prodRec.track) {
          const newProdQty = prodRec.inventory - item.quantity;
          const newReserved = prodRec.reserved + item.quantity;
          await db.update(products)
            .set({
              stock: newProdQty > 0 ? newProdQty : 0,
              reservedStock: newReserved > 0 ? newReserved : 0
            })
            .where(eq(products.id, item.productId));
        }
      }

      // Record inventory deduction transaction once per item
      await db.insert(inventoryTransactions).values({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        type: 'sale',
        reference: job.id?.toString(),
      });

    } else if (job.name === 'deliverStock') {
      // Stock was already taken out of main inventory and placed in reserved. 
      // Now just subtract from reserved.
      if (item.variantId) {
        await db.update(productVariants)
          .set({
            reservedStock: sql`GREATEST(0, ${productVariants.reservedStock} - ${item.quantity})`
          })
          .where(eq(productVariants.id, item.variantId));
      } else {
        await db.update(products)
          .set({
            reservedStock: sql`GREATEST(0, ${products.reservedStock} - ${item.quantity})`
          })
          .where(eq(products.id, item.productId));
      }
    } else if (job.name === 'cancelReservation') {
      // Return reserved stock back to main inventory
      if (item.variantId) {
        await db.update(productVariants)
          .set({
            inventoryQuantity: sql`${productVariants.inventoryQuantity} + ${item.quantity}`,
            reservedStock: sql`GREATEST(0, ${productVariants.reservedStock} - ${item.quantity})`
          })
          .where(eq(productVariants.id, item.variantId));
      } else {
        await db.update(products)
          .set({
            stock: sql`${products.stock} + ${item.quantity}`,
            reservedStock: sql`GREATEST(0, ${products.reservedStock} - ${item.quantity})`
          })
          .where(eq(products.id, item.productId));
      }

      // Record return transaction
      await db.insert(inventoryTransactions).values({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        type: 'return',
        reference: job.id?.toString(),
      });
    }
  }
}
