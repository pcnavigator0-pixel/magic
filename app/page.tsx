"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EventCountdown } from "@/app/components/event-countdown";
import { NewsImageCarousel } from "@/app/components/news-image-carousel";
import { SiteHeader } from "@/app/components/site-header";
import {
  buildStandings,
  fallbackMagicData,
  formatDisplayDate,
  getMagicData,
  type MagicData,
} from "@/lib/magic-data";

const metricTargets = [90, 2548, 25, 256];

export default function Home() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [metricsStarted, setMetricsStarted] = useState(false);
  const [metrics, setMetrics] = useState([0, 0, 0, 0]);
  const [siteData, setSiteData] = useState<MagicData>(fallbackMagicData);
  const metricsRef = useRef<HTMLElement>(null);
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
          const target = metricTargets[index];
          const increment = Math.ceil(target / 80);
          return Math.min(value + increment, target);
        });

        if (next.every((value, index) => value === metricTargets[index])) {
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
      <SiteHeader />

      <div className="hero-container" id="home">
        <main className="hero-main">
          <div className="hero-left">
            <span className="weekly-digest">Weekly Digest</span>
            <h1 className="hero-title">Detailed basketball games news & reviews</h1>
            <p className="hero-description">
              Consectetur adipiscing elit, sed do eiusmod tempor incididunt dolore magna aliqua.
            </p>
            <a className="btn-primary" href="/news">Read More</a>
          </div>

          {featuredNews && <div className="hero-right">
            <div className="recent-post-card">
              <span className="card-label">Recent post</span>
              {featuredNews.image_url && <div className="card-img-wrapper">
                <NewsImageCarousel imageValue={featuredNews.image_url} alt={featuredNews.title} autoAdvanceMs={3400} />
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
              teams={["Magic Initiative Rwanda", match.opponent_name].filter(Boolean).join(" - ")}
              league={match.league}
              location={match.venue}
              left="#E64A19"
              right={["#673AB7", "#1976D2", "#388E3C", "#D32F2F"][index % 4]}
              variant={["diamond", "square", "triangle", "line"][index % 4] as TeamIconVariant}
            />
          ))}
        </div>
        <a className="section-more" href="/matches">View more matches</a>
      </section>

      {featuredNews && <section className="articles-section">
        <span className="section-label">Our Articles</span>
        <h2 className="section-title">Trending now</h2>

        <div className="articles-container">
          <div className="article-featured">
            {featuredNews.image_url && (
              <NewsImageCarousel
                imageValue={featuredNews.image_url}
                alt={featuredNews.title}
                className="main-img article-featured-carousel"
                autoAdvanceMs={3400}
              />
            )}
            <div>
              <span className="badge-category">{featuredNews.category}</span>
              <h2>{featuredNews.title}</h2>
              {featuredNews.excerpt && <p>{featuredNews.excerpt}</p>}
              <div className="article-meta-footer">{formatDisplayDate(featuredNews.published_at)} • Magic Initiative Rwanda</div>
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
        <a className="section-more" href="/news">View more news</a>
      </section>}

      <section className="table-section">
        <span className="section-label">Table</span>
        <h2 className="section-title table-title">League</h2>

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
        <a className="btn-outline" href="/standings">View Full Table</a>
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
        <a className="section-more section-more-dark" href="/roster">View more players</a>
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
        <a className="section-more" href="/news">View all news</a>
      </section>

      <section className="events-preview-section">
        <span className="section-label">Events</span>
        <h2 className="section-title">Upcoming club events</h2>

        <div className="events-preview-grid">
          {siteData.events.slice(0, 3).map((event) => (
            <div className="event-preview-card" key={event.id}>
              <span>{formatDisplayDate(event.event_date)}</span>
              <h3>{event.title}</h3>
              <p>{event.venue}</p>
              <EventCountdown eventDate={event.event_date} eventTime={event.event_time} />
            </div>
          ))}
        </div>
        <a className="section-more" href="/events">View more events</a>
      </section>

      <footer className="site-footer">
        <div className="footer-callout">
          <div>
            <span>Stay in the game</span>
            <h2>Fresh scores, stories, and roster updates every week.</h2>
          </div>
          <a href="/matches">View latest scores</a>
        </div>

        <div className="footer-top">
          <div className="footer-brand">
            <div className="logo-badge">
              <span className="ball">🏀</span>
              <span className="title">Magic Initiative Rwanda</span>
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
            <Link href="/">Home</Link>
            <a href="/matches">Scores</a>
            <a href="/standings">Standings</a>
            <a href="/news">Latest news</a>
          </div>

          <div className="footer-column">
            <h3>Club</h3>
            <a href="/events">Events</a>
            <a href="/matches">SportsPress</a>
            <a href="/roster">Roster</a>
            <a href="/shop">Shop</a>
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
          <span>© 2026 Magic Initiative Rwanda. All rights reserved.</span>
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
      {image && <NewsImageCarousel imageValue={image} alt={alt} autoAdvanceMs={3400} />}
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
      {image && <NewsImageCarousel imageValue={image} alt={`${title} Feature Image`} autoAdvanceMs={3400} />}
      <span className="section-label news-card-label">{category}</span>
      <h3>{title}</h3>
      <div className="news-footer-meta">{date} • Magic Initiative Rwanda</div>
    </div>
  );
}
