export type CartProduct = {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
};

export type CartItem = CartProduct & {
  quantity: number;
};

export const cartStorageKey = "magic.shop.cart";
export const cartUpdatedEvent = "magic-shop-cart-updated";

export function readCart() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(cartStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed.filter((item) => item.id && item.quantity > 0) : [];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(cartStorageKey, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(cartUpdatedEvent, { detail: items }));
}

export function addCartItem(product: CartProduct) {
  const items = readCart();
  const existing = items.find((item) => item.id === product.id);

  if (existing) {
    existing.quantity += 1;
    saveCart(items);
    return;
  }

  saveCart([...items, { ...product, quantity: 1 }]);
}

export function cartQuantity(items: CartItem[]) {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function cartTotal(items: CartItem[]) {
  return items.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
}
