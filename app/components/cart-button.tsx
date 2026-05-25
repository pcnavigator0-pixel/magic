"use client";

import { useEffect, useMemo, useState } from "react";
import {
  cartQuantity,
  cartTotal,
  cartUpdatedEvent,
  readCart,
  saveCart,
  type CartItem,
} from "./cart-store";

const whatsappNumber = "250796438511";

export function CartButton() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const quantity = cartQuantity(items);
  const total = cartTotal(items);
  const currency = items[0]?.currency || "RWF";

  useEffect(() => {
    function refreshCart() {
      setItems(readCart());
    }

    refreshCart();

    window.addEventListener(cartUpdatedEvent, refreshCart);
    window.addEventListener("storage", refreshCart);
    return () => {
      window.removeEventListener(cartUpdatedEvent, refreshCart);
      window.removeEventListener("storage", refreshCart);
    };
  }, []);

  const whatsappHref = useMemo(() => {
    const lines = [
      "Hello MAGIC BBC, I would like to order:",
      ...items.map((item) => `- ${item.name} x${item.quantity} (${formatPrice(item.price_cents * item.quantity, item.currency)})`),
      `Total: ${formatPrice(total, currency)}`,
    ];

    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(lines.join("\n"))}`;
  }, [currency, items, total]);

  function updateQuantity(id: string, quantityDelta: number) {
    const next = items
      .map((item) => (item.id === id ? { ...item, quantity: item.quantity + quantityDelta } : item))
      .filter((item) => item.quantity > 0);

    setItems(next);
    saveCart(next);
  }

  function clearCart() {
    setItems([]);
    saveCart([]);
  }

  return (
    <div className="cart-widget">
      <button className="icon-btn" aria-label="Open cart" type="button" onClick={() => setIsOpen((open) => !open)}>
        <i className="fa-solid fa-cart-shopping" aria-hidden="true" />
        <span className="cart-badge">{quantity}</span>
      </button>

      {isOpen && (
        <div className="cart-overlay" role="presentation" onMouseDown={() => setIsOpen(false)}>
          <div className="cart-modal" role="dialog" aria-modal="true" aria-label="Shopping cart" onMouseDown={(event) => event.stopPropagation()}>
            <div className="cart-modal-header">
              <div>
                <span>Cart</span>
                <h2>Your order</h2>
              </div>
              <button type="button" aria-label="Close cart" onClick={() => setIsOpen(false)}>
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>

            {items.length === 0 ? (
              <p className="cart-empty">Your cart is empty.</p>
            ) : (
              <>
                <div className="cart-items">
                  {items.map((item) => (
                    <div className="cart-item" key={item.id}>
                      <div>
                        <strong>{item.name}</strong>
                        <span>{formatPrice(item.price_cents, item.currency)}</span>
                      </div>
                      <div className="cart-stepper" aria-label={`${item.name} quantity`}>
                        <button type="button" onClick={() => updateQuantity(item.id, -1)}>-</button>
                        <span>{item.quantity}</span>
                        <button type="button" onClick={() => updateQuantity(item.id, 1)}>+</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="cart-total">
                  <span>Total</span>
                  <strong>{formatPrice(total, currency)}</strong>
                </div>

                <div className="cart-actions">
                  <button type="button" onClick={clearCart}>Clear</button>
                  <a href={whatsappHref} target="_blank" rel="noreferrer">
                    <i className="fa-brands fa-whatsapp" aria-hidden="true" />
                    Continue with WhatsApp
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(priceCents / 100);
}
