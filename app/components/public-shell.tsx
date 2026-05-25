import Link from "next/link";
import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";

export function PublicFooter() {
  return (
    <footer className="site-footer public-footer">
      <div className="footer-top">
        <div className="footer-brand">
          <div className="logo-badge">
            <span className="ball">BB</span>
            <span className="title">MAGIC BBC</span>
          </div>
          <p>Basketball stories, match scores, standings, and team updates for fans who follow every possession.</p>
        </div>

        <div className="footer-column">
          <h3>Explore</h3>
          <Link href="/matches">Scores</Link>
          <Link href="/standings">Standings</Link>
          <Link href="/news">Latest news</Link>
        </div>

        <div className="footer-column">
          <h3>Club</h3>
          <Link href="/events">Events</Link>
          <Link href="/roster">Roster</Link>
          <Link href="/shop">Shop</Link>
          <Link href="/login">Portal Login</Link>
        </div>
      </div>
    </footer>
  );
}

export function PublicPageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="public-page">
        <section className="public-hero">
          <span>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </section>
        {children}
      </main>
      <PublicFooter />
    </>
  );
}
