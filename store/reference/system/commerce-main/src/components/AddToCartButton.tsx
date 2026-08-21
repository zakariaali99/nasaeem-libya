'use client';

import { Button } from '@/components/ui/button';
import { useCart, useCartActions } from '@/hooks/use-cart';
import { Loader2, Trash } from 'lucide-react';
import { useState } from 'react';
import { useAppSession } from '@/components/providers/SessionProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';

interface AddToCartButtonProps {
  variantId?: string | null;
  productId?: string | null;
  availableQuantity?: number | null;
}

export function AddToCartButton({ variantId, productId, availableQuantity }: AddToCartButtonProps) {
  // If out of stock, show disabled out-of-stock state
  if (availableQuantity === 0) {
    return (
      <div className="h-12 mt-4">
        <Button size="lg" className="w-full md:w-auto" disabled>
          غير متوفر في المخزن
        </Button>
      </div>
    );
  }
  const cart = useCart();
  const cartActions = useCartActions();
  // Check user session and auth dialog state
  const { session } = useAppSession();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const router = useRouter();
  // Determine current quantity for variant or product
  const isVariant = variantId != null;
  const currentItem = cart?.items.find(i =>
    isVariant
      ? i.variantId === variantId
      : i.variantId == null && i.productId === productId
  );
  const currentQuantity = currentItem?.quantity || 0;

  const [loadingAction, setLoadingAction] = useState<'add' | 'inc' | 'dec' | null>(null);

  const handleAdd = async () => {
    setLoadingAction('add');
    if (variantId) {
      await cartActions.addItem({ variantId, quantity: 1 });
    } else if (productId) {
      await cartActions.addItem({ productId, quantity: 1 });
    }
    setLoadingAction(null);
  };
  const handleIncrement = async () => {
    setLoadingAction('inc');
    if (variantId) {
      await cartActions.updateItemQuantity({ variantId, quantity: currentQuantity + 1 });
    } else if (productId) {
      await cartActions.updateItemQuantity({ productId, quantity: currentQuantity + 1 });
    }
    setLoadingAction(null);
  };
  const handleDecrement = async () => {
    setLoadingAction('dec');
    if (variantId) {
      await cartActions.updateItemQuantity({ variantId, quantity: currentQuantity - 1 });
    } else if (productId) {
      await cartActions.updateItemQuantity({ productId, quantity: currentQuantity - 1 });
    }
    setLoadingAction(null);
  };
  const handleRemove = async () => {
    setLoadingAction('dec');
    if (variantId) {
      await cartActions.removeItem({ variantId });
    } else if (productId) {
      await cartActions.removeItem({ productId });
    }
    setLoadingAction(null);
  };

  return (
    <>
      <div className="h-12 mt-4">
        {currentQuantity === 0 ? (
          <Button
            size="lg"
            className="w-full md:w-auto"
            onClick={() => {
              if (!session) {
                setAuthDialogOpen(true);
              } else {
                handleAdd();
              }
            }}
            disabled={
              (variantId ? !variantId : !productId) ||
              loadingAction === 'add' ||
              (availableQuantity != null && availableQuantity < 1)
            }
          >
            {loadingAction === 'add' ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'أضف إلى السلة'}
          </Button>
        ) : (
          <div className="flex items-center justify-between bg-gray-100 rounded-full p-1 w-40 mx-auto md:mx-0">
            <Button variant="outline" size="icon" className="rounded-full" onClick={currentQuantity > 1 ? handleDecrement : handleRemove} disabled={loadingAction === 'dec'}>
              {loadingAction === 'dec' ? (
                <Loader2 className="animate-spin" size={16} />
              ) : currentQuantity > 1 ? (
                '-'
              ) : (
                <Trash size={16} />
              )}
            </Button>
            <span className="mx-2 font-bold">{currentQuantity}</span>
            <Button variant="outline" size="icon" className="rounded-full" onClick={handleIncrement} disabled={
              loadingAction === 'inc' || (availableQuantity != null && currentQuantity >= availableQuantity)
            }>
              {loadingAction === 'inc' ? <Loader2 className="animate-spin" size={16} /> : '+'}
            </Button>
          </div>
        )}
      </div>
      {/* Dialog for prompting user to register or login */}
      <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>يرجى التسجيل أو تسجيل الدخول</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            يجب أن تكون مسجلا للدخول لإضافة عناصر إلى السلة.
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAuthDialogOpen(false); router.push('/register'); }}>
              تسجيل
            </Button>
            <Button onClick={() => { setAuthDialogOpen(false); router.push('/login'); }}>
              تسجيل الدخول
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
