"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { FormEvent, useEffect, useState } from "react";
import {
  createSlug,
  daysUntil,
  fallbackMagicData,
  formatDisplayDate,
  getMagicData,
  insertEvent,
  insertMatch,
  insertNewsPost,
  insertPlayer,
  updateCoachProfile,
  type MagicData,
} from "@/lib/magic-data";
import styles from "./coach-dashboard.module.css";

const panels = [
  { id: "events", label: "Post New Events", icon: "fa-calendar-plus" },
  { id: "matches", label: "Record Matches", icon: "fa-chart-line" },
  { id: "players", label: "Add Player Profile", icon: "fa-person-running" },
  { id: "news", label: "Publish News", icon: "fa-newspaper" },
  { id: "history", label: "Match Logs", icon: "fa-clipboard-list" },
  { id: "settings", label: "Settings", icon: "fa-gear" },
] as const;

type PanelId = (typeof panels)[number]["id"];

export default function CoachDashboardPage() {
  const [activePanel, setActivePanel] = useState<PanelId>("events");
  const [coachName, setCoachName] = useState("");
  const [coachRole, setCoachRole] = useState("");
  const [clubName, setClubName] = useState("");
  const [dashboardData, setDashboardData] = useState<MagicData>(fallbackMagicData);
  const [formError, setFormError] = useState("");
  const wins = dashboardData.matches.filter((match) => match.home_score >= match.away_score && match.status === "final").length;
  const losses = dashboardData.matches.filter((match) => match.home_score < match.away_score && match.status === "final").length;
  const nextEvent = dashboardData.events[0];

  function applyDashboardData(data: MagicData) {
    setDashboardData(data);
    if (data.coachProfile) {
      setCoachName(data.coachProfile.full_name);
      setCoachRole(data.coachProfile.role);
      setClubName(data.coachProfile.club_name);
    }
  }

  async function refreshDashboard() {
    const data = await getMagicData();
    applyDashboardData(data);
  }

  useEffect(() => {
    let ignore = false;

    getMagicData().then((data) => {
      if (!ignore) applyDashboardData(data);
    });

    return () => {
      ignore = true;
    };
  }, []);

  async function runDashboardAction(action: () => Promise<void>, successMessage: string) {
    setFormError("");

    try {
      await action();
      window.alert(successMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save this item.";
      setFormError(message);
      window.alert(message);
    }
  }

  async function handleEventCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const form = event.currentTarget;
    await runDashboardAction(async () => {
      await insertEvent({
        title: String(data.get("title")),
        category: String(data.get("category")),
        event_date: String(data.get("eventDate")),
        event_time: String(data.get("eventTime") || "") || null,
        venue: String(data.get("venue")),
        description: String(data.get("description") || "") || null,
        is_published: true,
      });
      await refreshDashboard();
      form.reset();
    }, "Event saved to Supabase and published.");
  }

  async function handleMatchCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const form = event.currentTarget;
    await runDashboardAction(async () => {
      await insertMatch({
        match_date: String(data.get("matchDate")),
        opponent_name: String(data.get("opponentName")),
        home_score: Number(data.get("homeScore") || 0),
        away_score: Number(data.get("awayScore") || 0),
        venue: String(data.get("venue") || "") || null,
        league: String(data.get("league")),
        mvp_name: String(data.get("mvpName") || "") || null,
        status: "final",
      });
      await refreshDashboard();
      form.reset();
    }, "Match saved to Supabase and standings updated.");
  }

  async function handlePlayerCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const form = event.currentTarget;
    await runDashboardAction(async () => {
      await insertPlayer({
        full_name: String(data.get("fullName")),
        jersey_number: Number(data.get("jerseyNumber") || 0),
        position: String(data.get("position")),
        height: String(data.get("height") || "") || null,
        bio: String(data.get("bio") || "") || null,
        photo_url: String(data.get("photoUrl") || "") || null,
        status: "active",
      });
      await refreshDashboard();
      form.reset();
    }, "Player saved to Supabase and added to the roster.");
  }

  async function handleNewsCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("newsTitle"));
    const form = event.currentTarget;
    await runDashboardAction(async () => {
      await insertNewsPost({
        title,
        slug: createSlug(title),
        category: String(data.get("newsCategory")),
        excerpt: String(data.get("excerpt") || "") || null,
        content: String(data.get("content") || "") || null,
        image_url: String(data.get("imageUrl") || "") || null,
        published_at: new Date().toISOString(),
        is_published: true,
      });
      await refreshDashboard();
      form.reset();
    }, "News post saved to Supabase and published.");
  }

  async function handleProfileUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const profile = dashboardData.coachProfile;
    const payload = {
      full_name: String(data.get("coachName") || coachName),
      role: String(data.get("coachRole") || coachRole),
      club_name: String(data.get("clubName") || clubName),
      email: String(data.get("email") || "") || null,
      phone: String(data.get("phone") || "") || null,
      training_base: String(data.get("base") || "") || null,
      bio: String(data.get("bio") || "") || null,
      avatar_url: String(data.get("avatarUrl") || "") || null,
    };

    await runDashboardAction(async () => {
      if (!profile) throw new Error("No coach profile exists in the database to update.");
      await updateCoachProfile(profile.id, payload);
      await refreshDashboard();
    }, "Profile settings saved to Supabase.");
  }

  return (
    <main className={styles.page}>
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.logo} aria-label="MAGIC BBC home">
          <span className={styles.ball}>🏀</span>
          <span className={styles.logoTitle}>MAGIC BBC</span>
        </Link>

        <span className={styles.menuTitle}>Management Engine</span>
        <ul className={styles.navList}>
          {panels.map((panel) => (
            <li key={panel.id}>
              <button
                type="button"
                className={`${styles.tabLink} ${activePanel === panel.id ? styles.activeTab : ""}`}
                onClick={() => setActivePanel(panel.id)}
              >
                <i className={`fa-solid ${panel.icon}`} aria-hidden="true" />
                {panel.label}
              </button>
            </li>
          ))}
        </ul>

        <div className={styles.sidebarFooter}>
          <p>Access level: {coachRole}</p>
          <p className={styles.systemVersion}>System Version 2026.1</p>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.workspaceHeader}>
          <div>
            <h1>Control Room</h1>
            <p>Manage team logistics, match analytics, roster profiles, and staff settings.</p>
          </div>
          <div className={styles.coachProfile}>
            <div>
              <h2>{coachName}</h2>
              <span>{clubName}</span>
            </div>
            {dashboardData.coachProfile?.avatar_url && (
              <img
                className={styles.coachAvatar}
                src={dashboardData.coachProfile.avatar_url}
                alt="Coach profile"
              />
            )}
          </div>
        </header>

        {formError && <p className={styles.formError}>{formError}</p>}

        <section className={styles.analyticsStrip} aria-label="Team summary">
          <div className={styles.analyticCard}><span>Total Wins</span><h3>{wins}</h3></div>
          <div className={styles.analyticCard}><span>Loss Record</span><h3>{losses}</h3></div>
          <div className={styles.analyticCard}><span>Active Roster</span><h3>{dashboardData.players.length}</h3></div>
          <div className={styles.analyticCard}><span>Next Event</span><h3>{nextEvent ? `${daysUntil(nextEvent.event_date)} Days` : "None"}</h3></div>
        </section>

        <section className={`${styles.panel} ${activePanel === "events" ? styles.activePanel : ""}`}>
          <h2 className={styles.panelHeading}>Schedule & Post New Event</h2>
          <form onSubmit={handleEventCreate}>
            <div className={styles.formGrid}>
              <InputBox label="Event Headline Title"><input name="title" type="text" placeholder="Eastern Conference Finals Warm-up" required /></InputBox>
              <InputBox label="Event Category Type">
                <select name="category" defaultValue="Premier League Match">
                  <option>Premier League Match</option>
                  <option>Charity Cup Tournament</option>
                  <option>Fan Meet & Greet Session</option>
                  <option>Open Press Practice</option>
                </select>
              </InputBox>
              <InputBox label="Calendar Date"><input name="eventDate" type="date" required /></InputBox>
              <InputBox label="Tip-off Time"><input name="eventTime" type="time" required /></InputBox>
              <InputBox label="Arena Venue Location"><input name="venue" type="text" placeholder="BK Arena, Court A" required /></InputBox>
              <InputBox label="Event Description" full><textarea name="description" rows={4} placeholder="Short event details for fans..." /></InputBox>
            </div>
            <div className={styles.actionBar}><button type="submit" className={styles.primaryButton}>Publish Event</button></div>
          </form>
        </section>

        <section className={`${styles.panel} ${activePanel === "matches" ? styles.activePanel : ""}`}>
          <h2 className={styles.panelHeading}>Record Match Results</h2>
          <form onSubmit={handleMatchCreate}>
            <div className={styles.formGrid}>
              <InputBox label="Opponent Club Name"><input name="opponentName" type="text" placeholder="Kigali Titans" required /></InputBox>
              <InputBox label="League Match Context">
                <select name="league" defaultValue="Premier League">
                  <option>Premier League</option>
                  <option>Regular Season</option>
                  <option>Playoffs</option>
                  <option>Pre-season Tournament</option>
                </select>
              </InputBox>
              <InputBox label="Match Date"><input name="matchDate" type="date" required /></InputBox>
              <InputBox label="Arena Venue"><input name="venue" type="text" placeholder="BK Arena" /></InputBox>
              <InputBox label="MAGIC BBC Score"><input name="homeScore" type="number" placeholder="112" required /></InputBox>
              <InputBox label="Opponent Score"><input name="awayScore" type="number" placeholder="104" required /></InputBox>
              <InputBox label="Game MVP Player" full><input name="mvpName" type="text" placeholder="Aiden Foster" /></InputBox>
            </div>
            <div className={styles.actionBar}><button type="submit" className={styles.primaryButton}>Commit Match Scores</button></div>
          </form>
        </section>

        <section className={`${styles.panel} ${activePanel === "players" ? styles.activePanel : ""}`}>
          <h2 className={styles.panelHeading}>Add Roster Player Details</h2>
          <form onSubmit={handlePlayerCreate}>
            <div className={styles.formGrid}>
              <InputBox label="Full Player Name"><input name="fullName" type="text" placeholder="Jayson Tatum" required /></InputBox>
              <InputBox label="Jersey Number Allocation"><input name="jerseyNumber" type="number" placeholder="0" max="99" required /></InputBox>
              <InputBox label="Court Position Role">
                <select name="position" defaultValue="Point Guard (PG)">
                  <option>Point Guard (PG)</option>
                  <option>Shooting Guard (SG)</option>
                  <option>Small Forward (SF)</option>
                  <option>Power Forward (PF)</option>
                  <option>Center (C)</option>
                </select>
              </InputBox>
              <InputBox label="Height Metric Profile"><input name="height" type="text" placeholder={"6'8\""} /></InputBox>
              <InputBox label="Photo URL"><input name="photoUrl" type="url" placeholder="https://..." /></InputBox>
              <InputBox label="Biographical Scouting Summary Notes" full>
                <textarea name="bio" rows={4} placeholder="Enter performance highlights or metrics information details..." />
              </InputBox>
            </div>
            <div className={styles.actionBar}><button type="submit" className={styles.primaryButton}>Register Player Profile</button></div>
          </form>
        </section>

        <section className={`${styles.panel} ${activePanel === "news" ? styles.activePanel : ""}`}>
          <h2 className={styles.panelHeading}>Publish Website News</h2>
          <form onSubmit={handleNewsCreate}>
            <div className={styles.formGrid}>
              <InputBox label="News Title"><input name="newsTitle" type="text" placeholder="MAGIC BBC prepares for playoff push" required /></InputBox>
              <InputBox label="Category"><input name="newsCategory" type="text" defaultValue="Club" required /></InputBox>
              <InputBox label="Feature Image URL"><input name="imageUrl" type="text" placeholder="/photos/example.jpg or https://..." /></InputBox>
              <InputBox label="Excerpt"><input name="excerpt" type="text" placeholder="Short summary for cards..." /></InputBox>
              <InputBox label="Content" full><textarea name="content" rows={5} placeholder="Full article text..." /></InputBox>
            </div>
            <div className={styles.actionBar}><button type="submit" className={styles.primaryButton}>Publish News</button></div>
          </form>
        </section>

        <section className={`${styles.panel} ${activePanel === "history" ? styles.activePanel : ""}`}>
          <h2 className={styles.panelHeading}>Match Logs Records</h2>
          <div className={styles.tableScroll}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Opponent Matchup</th>
                  <th>Outcome Score</th>
                  <th>Status</th>
                  <th>MVP Performer</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.matches.map((match) => (
                  <MatchRow
                    key={match.id}
                    date={formatDisplayDate(match.match_date)}
                    opponent={match.opponent_name || ""}
                    score={`${match.home_score} - ${match.away_score}`}
                    status={match.home_score >= match.away_score ? "Win" : "Loss"}
                    mvp={match.mvp_name || "-"}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${styles.panel} ${activePanel === "settings" ? styles.activePanel : ""}`}>
          <h2 className={styles.panelHeading}>Profile Settings</h2>
          <form onSubmit={handleProfileUpdate}>
            <div className={styles.settingsProfileRow}>
              {dashboardData.coachProfile?.avatar_url && (
                <img
                  className={styles.settingsAvatar}
                  src={dashboardData.coachProfile.avatar_url}
                  alt="Current coach profile"
                />
              )}
              <div>
                <h3>{coachName}</h3>
                <p>Update the coach profile shown in the dashboard header and staff workspace.</p>
              </div>
            </div>

            <div className={styles.formGrid}>
              <InputBox label="Coach Full Name"><input name="coachName" type="text" defaultValue={coachName} required /></InputBox>
              <InputBox label="Role / Access Title"><input name="coachRole" type="text" defaultValue={coachRole} required /></InputBox>
              <InputBox label="Club Name"><input name="clubName" type="text" defaultValue={clubName} required /></InputBox>
              <InputBox label="Email Address"><input name="email" type="email" defaultValue={dashboardData.coachProfile?.email || ""} required /></InputBox>
              <InputBox label="Phone Number"><input name="phone" type="tel" defaultValue={dashboardData.coachProfile?.phone || ""} /></InputBox>
              <InputBox label="Training Base"><input name="base" type="text" defaultValue={dashboardData.coachProfile?.training_base || ""} /></InputBox>
              <InputBox label="Avatar URL"><input name="avatarUrl" type="url" defaultValue={dashboardData.coachProfile?.avatar_url || ""} /></InputBox>
              <InputBox label="Short Bio" full>
                <textarea name="bio" rows={4} defaultValue={dashboardData.coachProfile?.bio || ""} />
              </InputBox>
            </div>
            <div className={styles.actionBar}><button type="submit" className={styles.primaryButton}>Save Profile Settings</button></div>
          </form>
        </section>
      </section>
    </main>
  );
}

function InputBox({
  label,
  full = false,
  children,
}: {
  label: string;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`${styles.inputBox} ${full ? styles.fullWidth : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function MatchRow({
  date,
  opponent,
  score,
  status,
  mvp,
}: {
  date: string;
  opponent: string;
  score: string;
  status: "Win" | "Loss";
  mvp: string;
}) {
  return (
    <tr>
      <td>{date}</td>
      <td>{opponent}</td>
      <td>{score}</td>
      <td><span className={`${styles.badgeStatus} ${status === "Win" ? styles.badgeWin : styles.badgeLoss}`}>{status}</span></td>
      <td>{mvp}</td>
    </tr>
  );
}
