"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { fallbackMagicData, getMagicData, type MagicData } from "@/lib/magic-data";
import { CartButton } from "./cart-button";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/roster", label: "Roster" },
  { href: "/matches", label: "Matches" },
  { href: "/events", label: "Events" },
  { href: "/news", label: "News" },
  { href: "/shop", label: "Shop" },
  { href: "/login", label: "Portal" },
];

type DrawerMode = "menu" | "search" | null;
type SearchItem = {
  href: string;
  title: string;
  type: string;
  detail: string;
};

export function SiteHeader() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [siteData, setSiteData] = useState<MagicData>(fallbackMagicData);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 60);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let ignore = false;

    getMagicData().then((data) => {
      if (!ignore) setSiteData(data);
    });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("magic.recent.searches");
      if (stored) setRecentSearches(JSON.parse(stored) as string[]);
    } catch {
      setRecentSearches([]);
    }
  }, []);

  useEffect(() => {
    document.body.classList.toggle("drawer-open", Boolean(drawerMode));
    return () => document.body.classList.remove("drawer-open");
  }, [drawerMode]);

  const searchItems = buildSearchItems(siteData);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const suggestions = normalizedSearch
    ? searchItems
      .filter((item) => `${item.title} ${item.type} ${item.detail}`.toLowerCase().includes(normalizedSearch))
      .slice(0, 8)
    : [];
  const activeHref = getActiveHref(pathname);

  function openDrawer(mode: Exclude<DrawerMode, null>) {
    setDrawerMode(mode);
  }

  function closeDrawer() {
    setDrawerMode(null);
    setSearchTerm("");
  }

  function rememberSearch(value: string) {
    const term = value.trim();
    if (!term) return;

    const next = [term, ...recentSearches.filter((item) => item.toLowerCase() !== term.toLowerCase())].slice(0, 5);
    setRecentSearches(next);
    window.localStorage.setItem("magic.recent.searches", JSON.stringify(next));
  }

  return (
    <>
      <header id="mainHeader" className={isScrolled ? "scrolled" : ""}>
        <Link href="/" className="logo-container" aria-label="MAGIC BBC home">
          <div className="logo-badge">
            <span className="ball">BB</span>
            <span className="title">MAGIC BBC</span>
          </div>
        </Link>

        <nav>
          <ul>
            <li className={activeHref === "/" ? "active" : ""}><Link href="/">Home</Link></li>
            <li className={activeHref === "/roster" ? "active" : ""}><Link href="/roster">Roster</Link></li>
            <li className={activeHref === "/matches" ? "active" : ""}><Link href="/matches">Matches</Link></li>
            <li className={`dropdown ${activeHref === "/events" ? "active" : ""}`} id="eventsDropdown">
              <Link href="/events" className="dropdown-toggle">
                Events
              </Link>
              <ul className="dropdown-menu">
                <li><Link href="/events">Events List</Link></li>
                <li><Link href="/events">Events Month</Link></li>
                <li><Link href="/matches">Match Results</Link></li>
              </ul>
            </li>
            <li className={activeHref === "/news" ? "active" : ""}><Link href="/news">News</Link></li>
            <li className={activeHref === "/shop" ? "active" : ""}><Link href="/shop">Shop</Link></li>
            <li className={activeHref === "/login" ? "active" : ""}><Link href="/login">Portal</Link></li>
          </ul>
        </nav>

        <div className="header-utilities">
          <CartButton />
          <button className="icon-btn" aria-label="Search" onClick={() => openDrawer("search")} aria-expanded={drawerMode === "search"}>
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
          </button>
          <button className="icon-btn" aria-label="Menu" onClick={() => openDrawer("menu")} aria-expanded={drawerMode === "menu"}>
            <i className="fa-solid fa-grip" aria-hidden="true" />
          </button>
        </div>
      </header>

      {drawerMode && (
        <div className="header-drawer-layer" role="presentation" onMouseDown={closeDrawer}>
          <aside
            className="header-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={drawerMode === "menu" ? "Site menu" : "Site search"}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="drawer-head">
              <span>{drawerMode === "menu" ? "Menu" : "Search"}</span>
              <button type="button" aria-label="Close panel" onClick={closeDrawer}>
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>

            {drawerMode === "menu" ? (
              <div className="drawer-menu">
                {navLinks.map((link) => (
                  <Link key={link.href} href={link.href} onClick={closeDrawer} className={activeHref === link.href ? "active" : ""}>
                    {link.label}
                    <i className="fa-solid fa-arrow-right" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="drawer-search">
                <label>
                  <span>Search MAGIC BBC</span>
                  <input
                    autoFocus
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search news, players, products..."
                  />
                </label>

                {!normalizedSearch && recentSearches.length > 0 && (
                  <div className="search-section">
                    <h3>Recent search</h3>
                    <div className="recent-searches">
                      {recentSearches.map((term) => (
                        <button key={term} type="button" onClick={() => setSearchTerm(term)}>
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="search-section">
                  <h3>{normalizedSearch ? "Suggestions" : "Popular links"}</h3>
                  <div className="search-results">
                    {(normalizedSearch ? suggestions : searchItems.slice(0, 6)).map((item) => (
                      <Link key={`${item.href}-${item.title}`} href={item.href} onClick={() => { rememberSearch(searchTerm || item.title); closeDrawer(); }}>
                        <span>{item.type}</span>
                        <strong>{item.title}</strong>
                        <small>{item.detail}</small>
                      </Link>
                    ))}
                    {normalizedSearch && suggestions.length === 0 && (
                      <p className="search-empty">No matching result yet.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

function buildSearchItems(data: MagicData): SearchItem[] {
  return [
    ...navLinks.map((link) => ({ href: link.href, title: link.label, type: "Page", detail: "Open site section" })),
    ...data.news.map((post) => ({ href: "/news", title: post.title, type: "News", detail: post.category })),
    ...data.players.map((player) => ({ href: "/roster", title: player.full_name, type: "Player", detail: player.position })),
    ...data.events.map((event) => ({ href: "/events", title: event.title, type: "Event", detail: event.venue })),
    ...data.products.map((product) => ({ href: "/shop", title: product.name, type: "Product", detail: product.category })),
    ...data.matches.map((match) => ({ href: "/matches", title: match.opponent_name || "Match", type: "Match", detail: match.league })),
  ];
}

function getActiveHref(pathname: string) {
  const sortedLinks = [...navLinks].sort((a, b) => b.href.length - a.href.length);
  const activeLink = sortedLinks.find((link) => link.href === "/" ? pathname === "/" : pathname === link.href || pathname.startsWith(`${link.href}/`));

  return activeLink?.href || "";
}
