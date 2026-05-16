"use client";

import { useEffect, useRef, useState } from "react";
import {
  fallbackMagicData,
  formatDisplayDate,
  getMagicData,
  type MagicData,
  type Match,
} from "@/lib/magic-data";

export default function Home() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [metricsStarted, setMetricsStarted] = useState(false);
  const [metrics, setMetrics] = useState([0, 0, 0, 0]);
  const [siteData, setSiteData] = useState<MagicData>(fallbackMagicData);
  const dropdownRef = useRef<HTMLLIElement>(null);
  const metricsRef = useRef<HTMLElement>(null);
  const targets = [90, 2548, 25, 256];
  const featuredNews = siteData.news[0];
  const miniNews = siteData.news.slice(1, 4);
  const latestMatches = siteData.matches.slice(0, 4);
  const standings = buildStandings(siteData.matches);

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
    const closeDropdown = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);

  useEffect(() => {
    if (!metricsRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMetricsStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );

    observer.observe(metricsRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!metricsStarted) return;

    const timer = window.setInterval(() => {
      setMetrics((current) => {
        const next = current.map((value, index) => {
          const target = targets[index];
          const increment = Math.ceil(target / 80);
          return Math.min(value + increment, target);
        });

        if (next.every((value, index) => value === targets[index])) {
          window.clearInterval(timer);
        }

        return next;
      });
    }, 20);

    return () => window.clearInterval(timer);
  }, [metricsStarted]);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <>
      <header id="mainHeader" className={isScrolled ? "scrolled" : ""}>
        <div className="logo-container">
          <div className="logo-badge">
            <span className="ball">🏀</span>
            <span className="title">MAGIC BBC</span>
          </div>
        </div>

        <nav>
          <ul>
            <li className="active"><a href="#home">Home</a></li>
            <li><a href="#pages">Pages</a></li>
            <li><a href="#sportspress">Sportspress</a></li>
            <li className="dropdown" id="eventsDropdown" ref={dropdownRef}>
              <a
                href="#events"
                className="dropdown-toggle"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setIsDropdownOpen((open) => !open);
                }}
              >
                Events
              </a>
              <ul className={`dropdown-menu ${isDropdownOpen ? "show" : ""}`}>
                <li><a href="#events-list">Events List</a></li>
                <li><a href="#events-month">Events Month</a></li>
                <li><a href="#single-event">Single Event</a></li>
              </ul>
            </li>
            <li><a href="#blog">Blog</a></li>
            <li><a href="#shop">Shop</a></li>
            <li><a href="/login">Portal</a></li>
          </ul>
        </nav>

        <div className="header-utilities">
          <button className="icon-btn" aria-label="Cart">
            <i className="fa-solid fa-cart-shopping" aria-hidden="true" />
            <span className="cart-badge">0</span>
          </button>
          <button className="icon-btn" aria-label="Search">
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
          </button>
          <button className="icon-btn" aria-label="Menu">
            <i className="fa-solid fa-grip" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="hero-container" id="home">
        <main className="hero-main">
          <div className="hero-left">
            <span className="weekly-digest">Weekly Digest</span>
            <h1 className="hero-title">Detailed basketball games news & reviews</h1>
            <p className="hero-description">
              Consectetur adipiscing elit, sed do eiusmod tempor incididunt dolore magna aliqua.
            </p>
            <button className="btn-primary">Read More</button>
          </div>

          {featuredNews && <div className="hero-right">
            <div className="recent-post-card">
              <span className="card-label">Recent post</span>
              {featuredNews.image_url && <div className="card-img-wrapper">
                <img src={featuredNews.image_url} alt={featuredNews.title} />
              </div>}
              <div className="meta-data">
                <span className="meta-trending">{featuredNews.category}</span>
                <span className="meta-date">• {formatDisplayDate(featuredNews.published_at)}</span>
              </div>
              <h2 className="card-title">{featuredNews.title}</h2>
            </div>
          </div>}
        </main>

        <footer className="hero-footer">
          <a href="#tickerSection" className="scroll-down">↓ Scroll Down</a>
          <div className="social-links">
            <a href="#fb">Facebook</a>
            <a href="#x">X</a>
            <a href="#db">Dribbble</a>
            <a href="#ig">Instagram</a>
          </div>
        </footer>
      </div>

      <section className="scores-section" id="tickerSection">
        <div className="scores-carousel">
          {latestMatches.map((match, index) => (
            <ScoreCard
              key={match.id}
              date={formatDisplayDate(match.match_date)}
              score={`${match.home_score} - ${match.away_score}`}
              teams={["MAGIC BBC", match.opponent_name].filter(Boolean).join(" - ")}
              league={match.league}
              location={match.venue}
              left="#E64A19"
              right={["#673AB7", "#1976D2", "#388E3C", "#D32F2F"][index % 4]}
              variant={["diamond", "square", "triangle", "line"][index % 4] as TeamIconVariant}
            />
          ))}
        </div>
      </section>

      {featuredNews && <section className="articles-section">
        <span className="section-label">Our Articles</span>
        <h2 className="section-title">Trending now</h2>

        <div className="articles-container">
          <div className="article-featured">
            {featuredNews.image_url && <img className="main-img" src={featuredNews.image_url} alt={featuredNews.title} />}
            <div>
              <span className="badge-category">{featuredNews.category}</span>
              <h2>{featuredNews.title}</h2>
              {featuredNews.excerpt && <p>{featuredNews.excerpt}</p>}
              <div className="article-meta-footer">{formatDisplayDate(featuredNews.published_at)} • MAGIC BBC</div>
            </div>
          </div>

          <div className="articles-sidebar">
            {miniNews.map((post) => (
              <MiniArticle
                key={post.id}
                image={post.image_url}
                alt={post.title}
                category={post.category}
                date={formatDisplayDate(post.published_at)}
                title={post.title}
              />
            ))}
          </div>
        </div>
      </section>}

      <section className="table-section">
        <span className="section-label">Table</span>
        <h2 className="section-title table-title">Premier league</h2>

        <div className="table-container">
          <table className="standings-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Team</th>
                <th>E</th>
                <th>W</th>
                <th>L</th>
                <th>P</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row, index) => (
                <StandingRow
                  key={row.team}
                  pos={String(index + 1)}
                  team={row.team}
                  e={String(row.played)}
                  w={String(row.wins)}
                  l={String(row.losses)}
                  p={String(row.points)}
                />
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn-outline">View Full Table</button>
      </section>

      <section className="metrics-section" ref={metricsRef}>
        <div className="metrics-grid">
          {[
            ["People", metrics[0], "+"],
            ["Matches", metrics[1], ""],
            ["Years", metrics[2], "+"],
            ["Trophies", metrics[3], ""],
          ].map(([label, value, suffix]) => (
            <div className="metric-item" key={label}>
              <span className="metric-label">{label}</span>
              <div className="metric-number">{value}{suffix}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="roster-section">
        <span className="section-label roster-label">Players</span>
        <h2 className="section-title roster-title">Our main team</h2>

        <div className="roster-grid">
          {siteData.players.slice(0, 5).map((player) => (
            <PlayerCard
              key={player.id}
              number={String(player.jersey_number)}
              name={player.full_name}
              position={player.position}
              image={player.photo_url}
            />
          ))}
        </div>
      </section>

      <section className="news-section">
        <span className="section-label">Blog</span>
        <h2 className="section-title">Latest news</h2>

        <div className="news-grid">
          {siteData.news.slice(0, 3).map((post) => (
            <NewsCard
              key={post.id}
              image={post.image_url}
              title={post.title}
              category={post.category}
              date={formatDisplayDate(post.published_at)}
            />
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-callout">
          <div>
            <span>Stay in the game</span>
            <h2>Fresh scores, stories, and roster updates every week.</h2>
          </div>
          <a href="#tickerSection">View latest scores</a>
        </div>

        <div className="footer-top">
          <div className="footer-brand">
            <div className="logo-badge">
              <span className="ball">🏀</span>
              <span className="title">MAGIC BBC</span>
            </div>
            <p>Basketball stories, match scores, standings, and team updates for fans who follow every possession.</p>
            <div className="footer-socials" aria-label="Social links">
              <a href="#fb" aria-label="Facebook"><i className="fa-brands fa-facebook-f" aria-hidden="true" /></a>
              <a href="#x" aria-label="X"><i className="fa-brands fa-x-twitter" aria-hidden="true" /></a>
              <a href="#ig" aria-label="Instagram"><i className="fa-brands fa-instagram" aria-hidden="true" /></a>
              <a href="#yt" aria-label="YouTube"><i className="fa-brands fa-youtube" aria-hidden="true" /></a>
            </div>
          </div>

          <div className="footer-column">
            <h3>Explore</h3>
            <a href="#home">Home</a>
            <a href="#tickerSection">Scores</a>
            <a href="#team">Standings</a>
            <a href="#blog">Latest news</a>
          </div>

          <div className="footer-column">
            <h3>Club</h3>
            <a href="#events">Events</a>
            <a href="#sportspress">SportsPress</a>
            <a href="#pages">Roster</a>
            <a href="#shop">Shop</a>
            <a href="/login">Portal Login</a>
          </div>

          <div className="footer-newsletter">
            <h3>Join the courtside list</h3>
            <p>Get weekly scores, roster notes, and feature stories in your inbox.</p>
            <form>
              <input type="email" placeholder="Email address" aria-label="Email address" />
              <button type="submit">Subscribe</button>
            </form>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 MAGIC BBC. All rights reserved.</span>
          <div>
            <a href="#privacy">Privacy Policy</a>
            <a href="#terms">Terms</a>
          </div>
        </div>
      </footer>

      <button
        className="scroll-to-top-btn"
        id="scrollTopBtn"
        style={{ display: isScrolled ? "flex" : "none" }}
        aria-label="Scroll to Top"
        onClick={scrollToTop}
      >
        ↑
      </button>
    </>
  );
}

type TeamIconVariant = "diamond" | "square" | "triangle" | "line";

function ScoreCard({
  date,
  score,
  teams,
  league,
  location,
  left,
  right,
  variant,
}: {
  date: string;
  score: string;
  teams: string;
  league: string;
  location: string | null;
  left: string;
  right: string;
  variant: TeamIconVariant;
}) {
  return (
    <div className="score-card">
      <span className="score-date">{date}</span>
      <div className="score-matchup">
        <TeamIcon color={left} variant={variant} />
        <span className="score-numbers">{score}</span>
        <TeamIcon color={right} variant={variant === "line" ? "square" : "line"} />
      </div>
      <span className="score-teams">{teams}</span>
      <span className="league-tag">{league}</span>
      {location && <div className="match-location">{location}</div>}
    </div>
  );
}

function TeamIcon({ color, variant }: { color: string; variant: TeamIconVariant }) {
  return (
    <svg className="team-icon" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill={color} />
      {variant === "diamond" && <path d="M10 12 l6-6 6 6-6 6z" fill="#FFF" />}
      {variant === "square" && <rect x="10" y="10" width="12" height="12" fill="#FFF" />}
      {variant === "triangle" && <path d="M12 20 L16 10 L20 20 Z" fill="#FFF" />}
      {variant === "line" && <path d="M9 16 h14" stroke="#FFF" strokeWidth="4" />}
    </svg>
  );
}

function MiniArticle({ image, alt, category, date, title }: { image: string | null; alt: string; category: string; date: string; title: string }) {
  return (
    <div className="mini-article-row">
      {image && <img src={image} alt={alt} />}
      <div>
        <div className="mini-meta"><span>{category}</span> • {date}</div>
        <h3 className="mini-title">{title}</h3>
      </div>
    </div>
  );
}

function StandingRow({
  pos,
  team,
  e,
  w,
  l,
  p,
}: {
  pos: string;
  team: string;
  e: string;
  w: string;
  l: string;
  p: string;
}) {
  return (
    <tr>
      <td>{pos}</td>
      <td className="team-cell">🏀 <a href="#team" className="team-name-link color-cavs">{team}</a></td>
      <td>{e}</td>
      <td>{w}</td>
      <td>{l}</td>
      <td>{p}</td>
    </tr>
  );
}

function PlayerCard({ number, name, position, image }: { number: string; name: string; position: string; image: string | null }) {
  return (
    <div className="player-card">
      <div className="player-img-container">
        <span className="player-number">{number}</span>
        {image && <img src={image} alt={`${name} Portrait`} />}
      </div>
      <div className="player-info">
        <h3 className="player-name">{name}</h3>
        <span className="player-position">{position}</span>
      </div>
    </div>
  );
}

function NewsCard({ image, title, category, date }: { image: string | null; title: string; category: string; date: string }) {
  return (
    <div className="news-card">
      {image && <img src={image} alt={`${title} Feature Image`} />}
      <span className="section-label news-card-label">{category}</span>
      <h3>{title}</h3>
      <div className="news-footer-meta">{date} • MAGIC BBC</div>
    </div>
  );
}

function buildStandings(matches: Match[]) {
  const table = new Map<string, { team: string; played: number; wins: number; losses: number; points: number }>();

  function ensure(team: string) {
    if (!table.has(team)) {
      table.set(team, { team, played: 0, wins: 0, losses: 0, points: 0 });
    }

    return table.get(team)!;
  }

  matches
    .filter((match) => match.status === "final")
    .forEach((match) => {
      const magic = ensure("MAGIC BBC");
      const opponent = match.opponent_name ? ensure(match.opponent_name) : null;

      magic.played += 1;
      if (opponent) opponent.played += 1;

      if (match.home_score >= match.away_score) {
        magic.wins += 1;
        magic.points += 2;
        if (opponent) opponent.losses += 1;
      } else {
        if (opponent) {
          opponent.wins += 1;
          opponent.points += 2;
        }
        magic.losses += 1;
      }
    });

  return Array.from(table.values()).sort((a, b) => b.points - a.points || b.wins - a.wins || a.team.localeCompare(b.team));
}
