import { PublicPageShell } from "@/app/components/public-shell";
import { ShopProductActions } from "@/app/components/shop-product-actions";
import { getMagicData } from "@/lib/magic-data";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const data = await getMagicData();

  return (
    <PublicPageShell
      eyebrow="Shop"
      title="Magic Initiative Rwanda shop"
      description="Official merchandise, supporter gear, and club products from Magic Initiative Rwanda."
    >
      <section className="public-grid three-columns shop-grid">
        {data.products.map((product) => (
          <article className="public-card shop-card" key={product.id}>
            {product.image_url ? (
              <div className="product-page-main-image">
                <img src={product.image_url} alt={product.name} />
              </div>
            ) : (
              <div className="shop-product-placeholder">Magic Initiative Rwanda</div>
            )}
            <span>{product.category}</span>
            <h2>{product.name}</h2>
            {product.description && <p>{product.description}</p>}
            <div className="shop-card-footer">
              <strong>{formatPrice(product.price_cents, product.currency)}</strong>
              <small>{product.inventory_count > 0 ? `${product.inventory_count} in stock` : "Out of stock"}</small>
            </div>
            <ShopProductActions
              id={product.id}
              name={product.name}
              priceCents={product.price_cents}
              currency={product.currency}
              disabled={product.inventory_count <= 0}
            />
          </article>
        ))}
      </section>
      {data.products.length === 0 && (
        <section className="public-empty public-empty-panel">
          <h2>No products found</h2>
          <p>No published products are readable from Supabase yet.</p>
        </section>
      )}
    </PublicPageShell>
  );
}

function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(priceCents / 100);
}
