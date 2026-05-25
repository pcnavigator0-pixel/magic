"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EventCountdown } from "@/app/components/event-countdown";
import {
  fallbackMagicData,
  formatDisplayDate,
  getMagicData,
  type MagicData,
  type Player,
} from "@/lib/magic-data";
import { clearPortalSession, getStoredPortalSession, type PortalSession } from "@/lib/portal-auth";
import styles from "./player-dashboard.module.css";

export default function PlayerDashboardPage() {
  const [session, setSession] = useState<PortalSession | null>(null);
  const [data, setData] = useState<MagicData>(fallbackMagicData);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const session = getStoredPortalSession();

    if (!session) {
      window.location.href = "/login";
      return;
    }

    if (session.profile.role !== "player") {
      window.location.href = "/coach-dashboard";
      return;
    }

    let ignore = false;

    queueMicrotask(() => {
      if (ignore) return;
      setSession(session);
      setIsChecking(false);
    });

    getMagicData()
      .then((siteData) => {
        if (!ignore) setData(siteData);
      })
      .finally(() => {
        if (!ignore) setIsChecking(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const player = useMemo(() => {
    if (!session) return null;
    return findPlayerForSession(data.players, session);
  }, [data.players, session]);

  const upcomingEvent = data.events[0];
  const latestMatch = data.matches[0];
  const activeRoster = data.players.filter((item) => item.status === "active");

  function handleLogout() {
    clearPortalSession();
    window.location.href = "/login";
  }

  if (isChecking) {
    return <main className={styles.loading}>Checking portal access...</main>;
  }

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.logo} aria-label="MAGIC BBC home">
          <span className={styles.ball}>BB</span>
          <span className={styles.title}>MAGIC BBC</span>
        </Link>

        <div className={styles.topActions}>
          <Link href="/">Website</Link>
          <button type="button" className={styles.logoutButton} onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </header>

      <section className={styles.workspace}>
        <div className={styles.hero}>
          <section className={styles.welcomePanel}>
            <span className={styles.eyebrow}>Player Portal</span>
            <h1>Welcome back, {session?.profile.full_name || "MAGIC player"}</h1>
            <p>
              Track club updates, roster notes, recent match rhythm, and the next calendar item from your own player workspace.
            </p>
          </section>

          <section className={styles.profilePanel} aria-label="Player profile">
            {player?.photo_url ? (
              <img className={styles.profilePhoto} src={player.photo_url} alt={player.full_name} />
            ) : (
              <div className={styles.profileEmpty}>{initials(session?.profile.full_name || "MP")}</div>
            )}
            <div>
              <span className={styles.eyebrow}>Roster Card</span>
              <h2>{player?.full_name || session?.profile.full_name}</h2>
              <p>{player?.bio || "Your roster profile can be linked by matching this account email or name with a player record."}</p>
              <div className={styles.profileStats}>
                <div><span>Number</span><strong>{player ? `#${player.jersey_number}` : "Pending"}</strong></div>
                <div><span>Position</span><strong>{player?.position || "Player"}</strong></div>
                <div><span>Status</span><strong>{player?.status || "Active"}</strong></div>
              </div>
            </div>
          </section>
        </div>

        <section className={styles.grid} aria-label="Player summary">
          <div className={styles.card}><span>Active Roster</span><h3>{activeRoster.length}</h3></div>
          <div className={styles.card}><span>Latest Score</span><h3>{latestMatch ? `${latestMatch.home_score}-${latestMatch.away_score}` : "--"}</h3></div>
          <div className={styles.card}>
            <span>Next Event</span>
            <h3>{upcomingEvent ? <EventCountdown eventDate={upcomingEvent.event_date} eventTime={upcomingEvent.event_time} compact /> : "None"}</h3>
          </div>
        </section>

        <section className={styles.widePanel}>
          <div className={styles.sectionHeader}>
            <div>
              <span>Schedule</span>
              <h2>Upcoming team items</h2>
            </div>
            <span className={styles.pill}>MAGIC BBC</span>
          </div>

          <div className={styles.schedule}>
            {data.events.slice(0, 4).map((event) => (
              <div className={styles.scheduleRow} key={event.id}>
                <strong><EventCountdown eventDate={event.event_date} eventTime={event.event_time} compact /></strong>
                <div>
                  <strong>{event.title}</strong>
                  <p>{formatDisplayDate(event.event_date)}{event.event_time ? ` at ${event.event_time}` : ""} - {event.venue}</p>
                </div>
                <span className={styles.pill}>{event.category}</span>
              </div>
            ))}
            {data.events.length === 0 && (
              <div className={styles.scheduleRow}>
                <strong>No events</strong>
                <div>
                  <strong>Nothing has been published yet.</strong>
                  <p>Check back after the coach updates the calendar.</p>
                </div>
                <span className={styles.pill}>Open</span>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function findPlayerForSession(players: Player[], session: PortalSession) {
  const userId = session.user.id;
  const email = session.profile.email.toLowerCase();
  const fullName = session.profile.full_name.toLowerCase();
  const byAuthUser = players.find((player) => player.auth_user_id === userId);
  const byEmail = players.find((player) => player.email?.toLowerCase() === email);
  const byName = players.find((player) => player.full_name.toLowerCase() === fullName);

  return byAuthUser || byEmail || byName || null;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
