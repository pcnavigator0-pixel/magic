"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getMagicData, type Match, type Player } from "@/lib/magic-data";

type MatchFilter = "all" | Match["status"];
type SortMode = "newest" | "oldest" | "score";

const DEFAULT_HOME_TEAM = "Magic Initiative Rwanda";

export function MatchesBoard({ matches: initialMatches, players }: { matches: Match[]; players: Player[] }) {
  const [matches, setMatches] = useState(initialMatches);
  const [activeFilter, setActiveFilter] = useState<MatchFilter>("all");
  const [query, setQuery] = useState("");
  const [competition, setCompetition] = useState("all");
  const [season, setSeason] = useState("all");
  const [venue, setVenue] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const refreshMatches = async () => {
      const data = await getMagicData();
      if (isMounted) setMatches(data.matches);
    };

    const timer = window.setInterval(() => {
      refreshMatches().catch((error) => console.error("Failed to refresh live matches:", error));
    }, 10_000);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const publicMatches = useMemo(
    () => matches.filter((match) => match.status !== "canceled"),
    [matches],
  );

  const options = useMemo(() => {
    const leagues = unique(publicMatches.map((match) => match.league).filter(Boolean));
    const venues = unique(publicMatches.map((match) => match.venue || "").filter(Boolean));
    const seasons = unique(publicMatches.map((match) => new Date(match.match_date).getFullYear().toString()));

    return { leagues, venues, seasons };
  }, [publicMatches]);

  const filteredMatches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return publicMatches
      .filter((match) => activeFilter === "all" || match.status === activeFilter)
      .filter((match) => competition === "all" || match.league === competition)
      .filter((match) => season === "all" || new Date(match.match_date).getFullYear().toString() === season)
      .filter((match) => venue === "all" || match.venue === venue)
      .filter((match) => {
        if (!normalizedQuery) return true;

        return `${homeTeamName(match)} ${match.opponent_name || ""} ${match.league} ${match.venue || ""}`
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (sortMode === "score") return totalScore(b) - totalScore(a);
        const difference = matchDate(b).getTime() - matchDate(a).getTime();
        return sortMode === "newest" ? difference : -difference;
      });
  }, [activeFilter, competition, publicMatches, query, season, sortMode, venue]);

  const liveMatches = filteredMatches.filter((match) => match.status === "live");
  const upcomingMatches = filteredMatches.filter((match) => match.status === "scheduled");
  const finishedMatches = filteredMatches.filter((match) => match.status === "final");
  const featuredLiveMatch = publicMatches.find((match) => match.status === "live");
  const activeFilters = [competition, season, venue].filter((value) => value !== "all").length;

  return (
    <main className="matches-page">
      <section className="matches-hero" aria-labelledby="matches-title">
        <div className="matches-hero-copy">
          <h1 id="matches-title">Matches</h1>
          <p>Stay updated with all Magic Initiative Rwanda matches, live scores, results and more.</p>

          <div className="matches-tabs" role="tablist" aria-label="Match status">
            {[
              ["all", "All", "fa-table-cells"] as const,
              ["live", "Live", "fa-tower-broadcast"] as const,
              ["scheduled", "Upcoming", "fa-calendar-days"] as const,
              ["final", "Finished", "fa-circle-check"] as const,
            ].map(([value, label, icon]) => (
              <button
                key={value}
                type="button"
                className={activeFilter === value ? "active" : ""}
                onClick={() => setActiveFilter(value)}
                role="tab"
                aria-selected={activeFilter === value}
              >
                <i className={`fa-solid ${icon}`} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <LiveWidget match={featuredLiveMatch} now={now} />
      </section>

      <button
        type="button"
        className={`matches-filter-fab${filtersOpen ? " is-open" : ""}`}
        aria-expanded={filtersOpen}
        aria-controls="matches-filter-bar"
        onClick={() => setFiltersOpen((open) => !open)}
      >
        <i className={`fa-solid ${filtersOpen ? "fa-xmark" : "fa-filter"}`} />
        <span>{filtersOpen ? "Close" : "Filters"}</span>
        {activeFilters > 0 ? <b>{activeFilters}</b> : null}
      </button>

      <section id="matches-filter-bar" className={`matches-filter-bar${filtersOpen ? " is-open" : ""}`} aria-label="Match filters">
        <label className="matches-search">
          <i className="fa-solid fa-magnifying-glass" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search team..."
          />
        </label>

        <FilterSelect label="Competition" value={competition} onChange={setCompetition} options={options.leagues} />
        <FilterSelect label="Season" value={season} onChange={setSeason} options={options.seasons} />
        <FilterSelect label="Venue" value={venue} onChange={setVenue} options={options.venues} />

        <label className="matches-select">
          <span>Sort by</span>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="score">Highest score</option>
          </select>
        </label>

        <button
          type="button"
          className="matches-filter-button"
          onClick={() => {
            setCompetition("all");
            setSeason("all");
            setVenue("all");
            setQuery("");
          }}
        >
          <i className="fa-solid fa-filter" />
          Filters
          <span>{activeFilters}</span>
        </button>
      </section>

      <div className="matches-content">
        <MatchSection
          title="Live Now"
          tone="live"
          matches={liveMatches}
          emptyText="No live matches are available right now."
          render={(match) => <LiveMatchCard match={match} now={now} />}
        />

        <MatchSection
          title="Upcoming Matches"
          tone="upcoming"
          matches={upcomingMatches}
          emptyText="No upcoming matches match your filters."
          render={(match) => <UpcomingMatchCard match={match} now={now} />}
        />

        <MatchSection
          title="Finished Matches"
          tone="finished"
          matches={finishedMatches}
          emptyText="No finished matches match your filters."
          render={(match) => <FinishedMatchCard match={match} players={players} />}
        />
      </div>
    </main>
  );
}

function LiveWidget({ match, now }: { match?: Match; now: Date }) {
  if (!match) {
    return (
      <aside className="matches-live-widget">
        <div className="matches-live-label"><span /> Live Right Now</div>
        <div className="matches-widget-empty">No live match is running right now.</div>
      </aside>
    );
  }

  return (
    <aside className="matches-live-widget">
      <div className="matches-live-label"><span /> Live Right Now</div>
      <div className="matches-widget-score">
        <TeamMark name={homeTeamName(match)} />
        <div className="matches-score">
          <strong>{match.home_score} - {match.away_score}</strong>
          <LiveClock match={match} now={now} />
        </div>
        <TeamMark name={match.opponent_name || "Opponent"} variant="away" />
      </div>
      <a className="matches-widget-link" href="#live-matches">
        View Live Match
        <i className="fa-solid fa-arrow-right" />
      </a>
    </aside>
  );
}

function MatchSection({
  title,
  tone,
  matches,
  emptyText,
  render,
}: {
  title: string;
  tone: "live" | "upcoming" | "finished";
  matches: Match[];
  emptyText: string;
  render: (match: Match) => ReactNode;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [scrollState, setScrollState] = useState({ canScrollLeft: false, canScrollRight: false });

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const updateScrollState = () => {
      const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
      setScrollState({
        canScrollLeft: scroller.scrollLeft > 2,
        canScrollRight: scroller.scrollLeft < maxScrollLeft - 2,
      });
    };

    updateScrollState();
    scroller.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      scroller.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [matches.length]);

  const scrollMatches = (direction: "previous" | "next") => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const amount = scroller.clientWidth * 0.86;
    scroller.scrollBy({
      left: direction === "previous" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <section className={`match-section ${tone}`} id={tone === "live" ? "live-matches" : undefined}>
      <div className="matches-section-head">
        <div>
          <h2>{title}</h2>
          <span>{matches.length} Match{matches.length === 1 ? "" : "es"}</span>
        </div>
        {matches.length > 0 ? (
          <div className="matches-scroll-controls" aria-label={`${title} carousel controls`}>
            <button
              type="button"
              onClick={() => scrollMatches("previous")}
              disabled={!scrollState.canScrollLeft}
              aria-label={`Scroll ${title} left`}
            >
              <i className="fa-solid fa-chevron-left" />
            </button>
            <button
              type="button"
              onClick={() => scrollMatches("next")}
              disabled={!scrollState.canScrollRight}
              aria-label={`Scroll ${title} right`}
            >
              <i className="fa-solid fa-chevron-right" />
            </button>
          </div>
        ) : null}
      </div>
      <div className="matches-grid" ref={scrollerRef}>
        {matches.length ? matches.map((match) => <div className="matches-grid-item" key={match.id}>{render(match)}</div>) : <p className="matches-empty">{emptyText}</p>}
      </div>
    </section>
  );
}

function LiveMatchCard({ match, now }: { match: Match; now: Date }) {
  return (
    <article className="match-card live-card">
      <div className="match-card-topline">
        <span className="match-tag tag-live"><i className="fa-solid fa-tower-broadcast" /> Live</span>
        <div className="match-context">{match.league}</div>
      </div>
      <ScoreLine match={match} now={now} />
      <div className="match-meta live-venue" title={match.venue || "Venue not set"}><i className="fa-solid fa-location-dot" /> {match.venue || "Venue not set"}</div>
      <div className="match-actions">
        <a href="#" className="match-action primary"><i className="fa-regular fa-circle-play" /> Watch Live</a>
        <a href="#" className="match-action">Match Details <i className="fa-solid fa-chevron-right" /></a>
      </div>
    </article>
  );
}

function UpcomingMatchCard({ match, now }: { match: Match; now: Date }) {
  return (
    <article className="match-card upcoming-card">
      <div className="match-card-topline">
        <span className="match-tag tag-upcoming">Upcoming</span>
        <div className="match-context">{match.league}</div>
      </div>
      <div className="teams-row">
        <TeamMark name={homeTeamName(match)} />
        <strong className="match-vs">VS</strong>
        <TeamMark name={match.opponent_name || "Opponent"} variant="away" />
      </div>
      <div className="upcoming-meta">
        <div className="match-meta" title={formatMatchDateTime(match)}><i className="fa-regular fa-calendar" /> {formatMatchDateTime(match)}</div>
        <div className="match-meta" title={match.venue || "Venue not set"}><i className="fa-solid fa-location-dot" /> {match.venue || "Venue not set"}</div>
      </div>
      <div className="match-actions upcoming-actions">
        <span className="countdown"><i className="fa-regular fa-clock" /> Starts in <strong>{formatCountdown(matchDate(match), now)}</strong></span>
        <button type="button" className="match-action"><i className="fa-regular fa-bell" /> Set Reminder</button>
      </div>
    </article>
  );
}

function FinishedMatchCard({ match, players }: { match: Match; players: Player[] }) {
  const mvp = match.mvp_player_id ? players.find((player) => player.id === match.mvp_player_id) ?? null : null;
  const mvpName = mvp?.full_name || match.mvp_name;

  return (
    <article className="match-card finished-card">
      <div className="match-card-topline">
        <span className="match-tag tag-final">Final</span>
        <div className="match-context">{match.league}</div>
      </div>
      <ScoreLine match={match} />
      <div className="finished-meta">
        <div className="match-meta"><i className="fa-regular fa-calendar" /> {formatDisplayDate(match.match_date)}</div>
        <div className="match-meta" title={match.venue || "Venue not set"}><i className="fa-solid fa-location-dot" /> {match.venue || "Venue not set"}</div>
      </div>
      {mvpName ? (
        <div className="match-mvp">
          <PlayerAvatar player={mvp} name={mvpName} />
          <i className="fa-solid fa-trophy" />
          <span>MVP: <strong>{mvpName}</strong></span>
        </div>
      ) : null}
    </article>
  );
}

function PlayerAvatar({ player, name }: { player: Player | null; name: string }) {
  if (player?.photo_url) {
    return <img className="match-mvp-avatar" src={player.photo_url} alt="" />;
  }

  return <span className="match-mvp-avatar fallback">{initials(name)}</span>;
}

function ScoreLine({ match, now }: { match: Match; now?: Date }) {
  if (match.status === "live" && now) {
    return (
      <div className="live-matchup">
        <TeamMark name={homeTeamName(match)} />
        <div className="live-score">
          <strong>{match.home_score} - {match.away_score}</strong>
        </div>
        <TeamMark name={match.opponent_name || "Opponent"} variant="away" />
        <div className="live-status"><LiveClock match={match} now={now} /></div>
      </div>
    );
  }

  return (
    <div className="teams-row">
      <TeamMark name={homeTeamName(match)} />
      <div className="match-score">
        <strong>{match.home_score} - {match.away_score}</strong>
      </div>
      <TeamMark name={match.opponent_name || "Opponent"} variant="away" />
    </div>
  );
}

function TeamMark({ name, variant = "home" }: { name: string; variant?: "home" | "away" }) {
  return (
    <div className="team-mark">
      <span className={variant === "home" ? "home" : colorClass(name)}>{initials(name)}</span>
      <strong>{name}</strong>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="matches-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function matchDate(match: Match) {
  return new Date(`${match.match_date}T${match.match_time || "00:00:00"}`);
}

function totalScore(match: Match) {
  return match.home_score + match.away_score;
}

function homeTeamName(match: Match) {
  return match.home_team?.name || DEFAULT_HOME_TEAM;
}

function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function LiveClock({ match, now }: { match: Match; now: Date }) {
  const remaining = liveSecondsRemaining(match, now);
  const clockStatus = match.clock_status || "not_started";
  const isBreak = clockStatus === "running" && remaining === 0;
  const label = isBreak
    ? `Break - Q${match.current_quarter || 1} done`
    : `${clockLabel(clockStatus)} - Q${match.current_quarter || 1} - ${formatClock(remaining)}`;

  return <small>{label}</small>;
}

function liveSecondsRemaining(match: Match, now: Date) {
  const storedSeconds = match.quarter_seconds_remaining ?? 600;
  if (match.clock_status !== "running" || !match.clock_started_at) return storedSeconds;

  const startedAt = new Date(match.clock_started_at).getTime();
  if (Number.isNaN(startedAt)) return storedSeconds;

  const elapsedSeconds = Math.floor((now.getTime() - startedAt) / 1000);
  return Math.max(0, storedSeconds - elapsedSeconds);
}

function clockLabel(status: Match["clock_status"]) {
  if (status === "running") return "Live";
  if (status === "paused") return "Paused";
  if (status === "ended") return "Final";
  return "Ready";
}

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatMatchDateTime(match: Match) {
  const time = match.match_time ? ` - ${match.match_time.slice(0, 5)}` : "";
  return `${formatDisplayDate(match.match_date)}${time}`;
}

function formatCountdown(target: Date, now: Date) {
  const diff = Math.max(0, target.getTime() - now.getTime());
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);

  return `${days.toString().padStart(2, "0")}d : ${hours.toString().padStart(2, "0")}h : ${minutes.toString().padStart(2, "0")}m`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function colorClass(name: string) {
  const classes = ["blue", "green", "purple", "black"];
  const index = name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % classes.length;
  return classes[index];
}
