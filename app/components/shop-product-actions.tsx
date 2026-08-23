"use client";

import { useState } from "react";
import { addCartItem } from "./cart-store";

const whatsappNumber = "250796438511";

export function ShopProductActions({
  id,
  name,
  priceCents,
  currency,
  disabled,
}: {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  disabled: boolean;
}) {
  const [wasAdded, setWasAdded] = useState(false);

  function handleAddToCart() {
    addCartItem({
      id,
      name,
      price_cents: priceCents,
      currency,
    });
    setWasAdded(true);
    window.setTimeout(() => setWasAdded(false), 1600);
  }

  const whatsappMessage = [
    "Hello Magic Initiative Rwanda, I would like to order:",
    `- ${name} x1 (${formatPrice(priceCents, currency)})`,
    `Total: ${formatPrice(priceCents, currency)}`,
  ].join("\n");
  const whatsappHref = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div className="shop-action-row">
      <button type="button" className="shop-icon-action shop-cart-action" onClick={handleAddToCart} disabled={disabled}>
        <i className="fa-solid fa-cart-plus" aria-hidden="true" />
        <span>{disabled ? "Out of stock" : wasAdded ? "Added" : "Cart"}</span>
      </button>
      <a
        className="shop-icon-action shop-whatsapp-action"
        href={whatsappHref}
        target="_blank"
        rel="noreferrer"
        aria-label={`Order ${name} on WhatsApp`}
        title="Order on WhatsApp"
      >
        <i className="fa-brands fa-whatsapp" aria-hidden="true" />
      </a>
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
