"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { normalizeArticleBlocks } from "@/app/components/article-body";
import { EventCountdown } from "@/app/components/event-countdown";
import {
  fallbackMagicData,
  formatDisplayDate,
  getMagicData,
  type MagicData,
  type Notification,
  type Player,
} from "@/lib/magic-data";
import { getFreshPortalSession, signOutFromPortal, type PortalSession } from "@/lib/portal-auth";
import styles from "./player-dashboard.module.css";

function getNewsPreview(post: MagicData["news"][number]) {
  if (post.excerpt?.trim()) {
    return post.excerpt;
  }

  const paragraph = normalizeArticleBlocks(post.content, post.excerpt).find((block) => block.type === "paragraph");
  return paragraph?.text.substring(0, 150);
}

export default function PlayerDashboardPage() {
  const [session, setSession] = useState<PortalSession | null>(null);
  const [data, setData] = useState<MagicData>(fallbackMagicData);
  const [isChecking, setIsChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "matches" | "news" | "data" | "notifications">("overview");

  useEffect(() => {
    let ignore = false;
    let sessionCheckTimer: number | undefined;

    const redirectForSession = (currentSession: PortalSession | null) => {
      if (!currentSession) {
        window.location.href = "/login";
        return false;
      }

      if (currentSession.profile.role !== "player") {
        window.location.href = "/coach-dashboard";
        return false;
      }

      return true;
    };

    const bootstrap = async () => {
      const currentSession = await getFreshPortalSession();
      if (ignore || !currentSession || !redirectForSession(currentSession)) return;

      setSession(currentSession);
      setIsChecking(false);

      getMagicData(currentSession.access_token)
        .then((siteData) => {
          if (!ignore) setData(siteData);
        })
        .catch((error) => {
          console.error("Failed to load player dashboard data:", error);
        });

      sessionCheckTimer = window.setInterval(async () => {
        const freshSession = await getFreshPortalSession();
        if (!ignore && !redirectForSession(freshSession)) {
          if (sessionCheckTimer) window.clearInterval(sessionCheckTimer);
        }
      }, 60_000);
    };

    void bootstrap();
    return () => {
      ignore = true;
      if (sessionCheckTimer) window.clearInterval(sessionCheckTimer);
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
    void signOutFromPortal();
    window.location.href = "/login";
  }

  if (isChecking) {
    return <main className={styles.loading}>Checking portal access...</main>;
  }

  return (
    <main className={styles.page}>
      <header className={styles.navbar}>
        <div className={styles.logoBox}>
          <span className={styles.logoTop}>BB</span>
          <span className={styles.logoBottom}>Magic Initiative Rwanda</span>
        </div>
        <div className={styles.navActions}>
          <Link href="/" className={styles.btnOutline}>WEBSITE</Link>
          <button type="button" className={styles.btnSolid} onClick={handleLogout}>SIGN OUT</button>
        </div>
      </header>

      <div className={styles.dashboardContainer}>
        {/* Top Row: Hero + Profile */}
        <section className={styles.topRow}>
          <div className={styles.heroCard}>
            <div className={styles.heroContent}>
              <h1>Welcome back,<br/>{session?.profile.full_name || "MAGIC player"}</h1>
              <p>Track club updates, roster notes, recent match rhythm, and the next calendar item from your own player workspace.</p>
            </div>
          </div>

          <div className={styles.profileCard}>
            <div className={styles.profileHeader}>
              <div className={styles.avatarSquare}>
                {initials(session?.profile.full_name || "MP")}
              </div>
              <div className={styles.profileInfo}>
                <h2>{player?.full_name || session?.profile.full_name}</h2>
                <p className={styles.profileSubtext}>
                  {player?.bio || "Your roster profile can be linked by matching this account email or name with a player record."}
                </p>
              </div>
            </div>
            <div className={styles.profileStats}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>NUMBER</span>
                <span className={styles.statValue}>{player ? `#${player.jersey_number}` : "Pending"}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>POSITION</span>
                <span className={styles.statValue}>{player?.position || "Player"}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>STATUS</span>
                <span className={`${styles.statValue} ${styles.textOrange}`}>{player?.status || "Active"}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <section className={styles.tabNavigation}>
          <button
            className={`${styles.tabBtn} ${activeTab === "overview" ? styles.active : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "matches" ? styles.active : ""}`}
            onClick={() => setActiveTab("matches")}
          >
            Matches
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "news" ? styles.active : ""}`}
            onClick={() => setActiveTab("news")}
          >
            News
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "data" ? styles.active : ""}`}
            onClick={() => setActiveTab("data")}
          >
            My Data
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "notifications" ? styles.active : ""}`}
            onClick={() => setActiveTab("notifications")}
          >
            Notifications
          </button>
        </section>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <>
            <section className={styles.statsGrid}>
              <div className={styles.card}>
                <span className={styles.cardTitle}>ACTIVE ROSTER</span>
                <span className={styles.cardBigValue}>{activeRoster.length}</span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardTitle}>LATEST SCORE</span>
                <span className={styles.cardBigValue}>{latestMatch ? `${latestMatch.home_score}-${latestMatch.away_score}` : "--"}</span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardTitle}>NEXT EVENT</span>
                <div className={styles.badge}>
                  {upcomingEvent ? <EventCountdown eventDate={upcomingEvent.event_date} eventTime={upcomingEvent.event_time} compact /> : "No upcoming"}
                </div>
              </div>
            </section>

            <section className={styles.scheduleSection}>
              <div className={styles.scheduleHeader}>
                <div>
                  <span className={styles.cardTitle}>SCHEDULE</span>
                  <h3>Upcoming team items</h3>
                </div>
                <span className={styles.badgeOrange}>Magic Initiative Rwanda</span>
              </div>
              <div className={styles.scheduleList}>
                {data.events.slice(0, 5).map((event) => (
                  <div className={styles.scheduleItem} key={event.id}>
                    <div className={styles.scheduleTime}>
                      <EventCountdown eventDate={event.event_date} eventTime={event.event_time} compact />
                    </div>
                    <div className={styles.scheduleDetails}>
                      <strong>{event.title}</strong>
                      <p>{formatDisplayDate(event.event_date)}{event.event_time ? ` at ${event.event_time}` : ""} • {event.venue}</p>
                    </div>
                    <span className={styles.scheduleBadge}>{event.category}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* Matches Tab */}
        {activeTab === "matches" && (
          <section className={styles.scheduleSection}>
            <div className={styles.scheduleHeader}>
              <div>
                <span className={styles.cardTitle}>MATCH HISTORY</span>
                <h3>Recent and upcoming matches</h3>
              </div>
              <span className={styles.badgeOrange}>MATCHES</span>
            </div>
            <div className={styles.matchesTable}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Opponent</th>
                    <th>Score</th>
                    <th>Venue</th>
                    <th>Status</th>
                    <th>MVP</th>
                  </tr>
                </thead>
                <tbody>
                  {data.matches.length > 0 ? (
                    data.matches.map((match) => (
                      <tr key={match.id}>
                        <td className={styles.bold}>{formatDisplayDate(match.match_date)}</td>
                        <td>{match.opponent_name || "TBD"}</td>
                        <td className={styles.bold}>{match.home_score}-{match.away_score}</td>
                        <td>{match.venue || "N/A"}</td>
                        <td>
                          <span className={`${styles.badge} ${match.status === "final" ? styles.badgeFinal : styles.badgeScheduled}`}>
                            {match.status}
                          </span>
                        </td>
                        <td>{match.mvp_name || "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className={styles.noData}>No matches available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* News Tab */}
        {activeTab === "news" && (
          <section className={styles.scheduleSection}>
            <div className={styles.scheduleHeader}>
              <div>
                <span className={styles.cardTitle}>CLUB NEWS</span>
                <h3>Latest updates and announcements</h3>
              </div>
              <span className={styles.badgeOrange}>NEWS</span>
            </div>
            <div className={styles.newsList}>
              {data.news.filter(n => n.is_published).length > 0 ? (
                data.news
                  .filter(n => n.is_published)
                  .slice(0, 10)
                  .map((post) => (
                    <div className={styles.newsItem} key={post.id}>
                      {post.image_url && (
                        <img src={post.image_url} alt={post.title} className={styles.newsImage} />
                      )}
                      <div className={styles.newsContent}>
                        <div className={styles.newsHeader}>
                          <span className={styles.newsCategory}>{post.category}</span>
                          <span className={styles.newsDate}>{formatDisplayDate(post.published_at)}</span>
                        </div>
                        <h4>{post.title}</h4>
                        <p>{getNewsPreview(post)}</p>
                      </div>
                    </div>
                  ))
              ) : (
                <div className={styles.noData}>No news articles published yet</div>
              )}
            </div>
          </section>
        )}

        {/* Data Tab */}
        {activeTab === "data" && (
          <section className={styles.scheduleSection}>
            <div className={styles.scheduleHeader}>
              <div>
                <span className={styles.cardTitle}>PLAYER DATA</span>
                <h3>Your Supabase profile information</h3>
              </div>
            </div>

            <div className={styles.dataTable}>
              <table>
                <tbody>
                  <tr>
                    <td className={styles.dataLabel}>Full Name</td>
                    <td className={styles.dataValue}>{player?.full_name || "N/A"}</td>
                  </tr>
                  <tr>
                    <td className={styles.dataLabel}>Jersey Number</td>
                    <td className={styles.dataValue}>{player?.jersey_number || "Pending"}</td>
                  </tr>
                  <tr>
                    <td className={styles.dataLabel}>Position</td>
                    <td className={styles.dataValue}>{player?.position || "N/A"}</td>
                  </tr>
                  <tr>
                    <td className={styles.dataLabel}>Height</td>
                    <td className={styles.dataValue}>{player?.height || "N/A"}</td>
                  </tr>
                  <tr>
                    <td className={styles.dataLabel}>Bio</td>
                    <td className={styles.dataValue}>{player?.bio || "N/A"}</td>
                  </tr>
                  <tr>
                    <td className={styles.dataLabel}>Status</td>
                    <td className={styles.dataValue}>
                      <span className={`${styles.statusBadge} ${styles[`status${player?.status}`]}`}>
                        {player?.status || "N/A"}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className={styles.dataLabel}>Email</td>
                    <td className={styles.dataValue}>{player?.email || session?.profile.email || "N/A"}</td>
                  </tr>
                  <tr>
                    <td className={styles.dataLabel}>Photo URL</td>
                    <td className={styles.dataValue}>
                      {player?.photo_url ? (
                        <a href={player.photo_url} target="_blank" rel="noopener noreferrer" className={styles.link}>
                          View Photo
                        </a>
                      ) : (
                        "No photo uploaded"
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Notifications Tab */}
        {activeTab === "notifications" && (
          <section className={styles.scheduleSection}>
            <div className={styles.scheduleHeader}>
              <div>
                <span className={styles.cardTitle}>NOTIFICATIONS</span>
                <h3>Messages from your coach</h3>
              </div>
              {data.notifications.length > 0 && (
                <span className={styles.badgeOrange}>{data.notifications.filter(n => n.recipient_player_id === player?.id).length}</span>
              )}
            </div>
            <div className={styles.notificationsList}>
              {(() => {
                const playerNotifications = data.notifications.filter(n => n.recipient_player_id === player?.id);
                
                if (playerNotifications.length === 0) {
                  return (
                    <div className={styles.noData}>
                      No notifications yet. Your coach will send you messages here.
                    </div>
                  );
                }

                return (
                  <div className={styles.notificationsContainer}>
                    {playerNotifications.map((notification) => (
                      <div key={notification.id} className={styles.notificationItem}>
                        <div className={styles.notificationHeader}>
                          <span className={styles.notificationDate}>
                            {formatDisplayDate(notification.created_at)}
                          </span>
                          <span className={styles.notificationExpires}>
                            Expires: {formatDisplayDate(notification.expires_at)}
                          </span>
                        </div>
                        <p className={styles.notificationMessage}>{notification.message}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function findPlayerForSession(players: Player[], session: PortalSession) {
  const fullName = session.profile.full_name.toLowerCase();

  // Primary, reliable match: portal_profiles.player_id was set by
  // complete_player_registration() at signup time and always points at
  // the right row, regardless of which columns this players array has.
  const byPlayerId = session.profile.player_id
    ? players.find((player) => player.id === session.profile.player_id)
    : undefined;

  // Legacy fallback (e.g. for any account created before player_id
  // linking existed) — only useful if these columns happen to be present.
  const byAuthUser = players.find((player) => player.auth_user_id === session.user.id);
  const byEmail = players.find((player) => player.email?.toLowerCase() === session.profile.email.toLowerCase());
  const byName = players.find((player) => player.full_name.toLowerCase() === fullName);

  return byPlayerId || byAuthUser || byEmail || byName || null;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
