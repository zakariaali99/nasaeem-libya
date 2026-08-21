import { getCache, setCache, deleteCache } from ".";

// Default TTL for carts (in seconds), e.g., 7 days
const CART_TTL_SECONDS = parseInt(process.env.CART_TTL_SECONDS || "604800", 10);

export interface CartItem {
  variantId?: string | null; // Present if adding a variant
  productId: string;          // Always the product ID
  quantity: number;
}

export interface Cart {
  items: CartItem[];
  deliveryRegionId: string | null;
  deliveryCityId: string | null; // For cities without regions
  notes: string | null;
  paymentMethod: string | null;
  address: string | null;
  useWallet?: boolean;
}

const cartKey = (userId: string) => `cart:${userId}`;

/**
 * Retrieve the entire cart for a user
 * @param userId Identifier for the user/session
 * @returns The cart, or null if the cart does not exist.
 */
export async function getCart(userId: string): Promise<Cart | null> {
  const key = cartKey(userId);
  const cart = await getCache<Cart>(key);
  return cart === undefined ? null : cart;
}

/**
 * Overwrite the cart for a user
 * @param userId Identifier for the user/session
 * @param cart Cart object
 */
export async function setCart(userId: string, cart: Cart): Promise<void> {
  const key = cartKey(userId);
  await setCache(key, cart, CART_TTL_SECONDS);
}

/**
 * Clear the cart for a user
 * @param userId Identifier for the user/session
 */
export async function clearCart(userId: string): Promise<void> {
  const key = cartKey(userId);
  await deleteCache(key);
}

/**
 * Add an item to the cart. If the item already exists, its quantity will be incremented.
 * If the cart doesn't exist, it will be created.
 * @param userId Identifier for the user/session
 * @param newItem Item to add to the cart
 */
export async function addItemToCart(userId: string, newItem: CartItem): Promise<void> {
  const cart = (await getCart(userId)) || { items: [], deliveryRegionId: null, deliveryCityId: null, notes: null, paymentMethod: null, address: null, useWallet: false };
  // Find existing item by variantId or productId
  const idx = newItem.variantId
    ? cart.items.findIndex((i) => i.variantId === newItem.variantId)
    : cart.items.findIndex((i) => !i.variantId && i.productId === newItem.productId);
  if (idx >= 0) {
    cart.items[idx].quantity += newItem.quantity;
  } else {
    cart.items.push(newItem);
  }
  await setCart(userId, cart);
}

/**
 * Remove a single item from the cart
 * @param userId Identifier for the user/session
 * @param variantId ID of the product variant to remove
 */
export async function removeCartItem(userId: string, id: string): Promise<void> {
  const cart = await getCart(userId);
  if (cart) {
    cart.items = cart.items.filter((i) => i.variantId !== id && i.productId !== id);
    await setCart(userId, cart);
  }
}

/**
 * Update quantity of a specific cart item, removing if quantity <= 0
 * @param userId Identifier for the user/session
 * @param variantId ID of the product variant to update
 * @param quantity New quantity
 */
export async function updateCartItemQuantity(
  userId: string,
  id: string,
  quantity: number
): Promise<void> {
  const cart = await getCart(userId);
  if (cart) {
    cart.items = cart.items
      .map((i) =>
        i.variantId === id || i.productId === id ? { ...i, quantity } : i
      )
      .filter((i) => i.quantity > 0);
    await setCart(userId, cart);
  }
}

/**
 * Update cart metadata like delivery region, notes, payment method, and address
 * @param userId Identifier for the user/session
 * @param metadata Partial cart data to update, including 'deliveryRegionId', 'notes', 'paymentMethod', and 'address'
 */
export async function updateCartMetadata(userId: string, metadata: Partial<Pick<Cart, 'deliveryRegionId' | 'deliveryCityId' | 'notes' | 'paymentMethod' | 'address'> & { useWallet?: boolean | null }>): Promise<void> {
  const cart = await getCart(userId);

  const newCart: Cart = {
    items: cart?.items || [],
    deliveryRegionId: cart?.deliveryRegionId || null,
    deliveryCityId: cart?.deliveryCityId || null,
    notes: cart?.notes || null,
    paymentMethod: cart?.paymentMethod || null,
    address: cart?.address || null,
    ...metadata,
    useWallet: metadata.useWallet !== undefined ? (metadata.useWallet === null ? undefined : metadata.useWallet) : (cart?.useWallet || false),
  };

  await setCart(userId, newCart);
}
