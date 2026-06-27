"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { FormEvent, useEffect, useState } from "react";
import { EventCountdown } from "@/app/components/event-countdown";
import {
  createSlug,
  deleteEvent,
  deleteMatch,
  deleteNewsPost,
  deletePlayerFully,
  deleteShopProduct,
  fallbackMagicData,
  formatDisplayDate,
  getCoachProfileForUser,
  getMagicData,
  insertCoachProfile,
  insertEvent,
  insertMatch,
  insertNewsPost,
  insertNotification,
  insertPlayer,
  insertShopProduct,
  updateCoachProfile,
  updateEvent,
  updateMatch,
  updateNewsPost,
  updatePlayer,
  updateShopProduct,
  type EventItem,
  type MagicData,
  type Match,
  type NewsPost,
  type Notification,
  type Player,
  type ShopProduct,
} from "@/lib/magic-data";
import { formatImageUrlsForStorage, parseImageUrls } from "@/lib/news-images";
import { clearPortalSession, getFreshPortalSession, getStoredPortalSession, type PortalSession } from "@/lib/portal-auth";
import styles from "./coach-dashboard.module.css";

const panels = [
  { id: "events", label: "New Events", icon: "fa-calendar-plus" },
  { id: "matches", label: "Matches", icon: "fa-chart-line" },
  { id: "players", label: "Players", icon: "fa-person-running" },
  { id: "news", label: "News", icon: "fa-newspaper" },
  { id: "products", label: "Shop Products", icon: "fa-shirt" },
  { id: "notifications", label: "Notifications", icon: "fa-bell" },
  { id: "history", label: "Match Logs", icon: "fa-clipboard-list" },
  { id: "settings", label: "Settings", icon: "fa-gear" },
] as const;

type PanelId = (typeof panels)[number]["id"];
type CollectionKey = "events" | "matches" | "players" | "news" | "products";
const uploadBucket = "magic-uploads";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function CoachDashboardPage() {
  const [activePanel, setActivePanel] = useState<PanelId>("events");
  const [coachName, setCoachName] = useState("");
  const [coachRole, setCoachRole] = useState("");
  const [clubName, setClubName] = useState("");
  const [dashboardData, setDashboardData] = useState<MagicData>(fallbackMagicData);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showMatchForm, setShowMatchForm] = useState(false);
  const [showPlayerForm, setShowPlayerForm] = useState(false);
  const [showNewsForm, setShowNewsForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showNotificationForm, setShowNotificationForm] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notificationForm, setNotificationForm] = useState({
    selectedPlayer: "",
    message: "",
    duration: 7,
  });
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editingNews, setEditingNews] = useState<NewsPost | null>(null);
  const [editingProduct, setEditingProduct] = useState<ShopProduct | null>(null);
  const [showStatsOnMobile, setShowStatsOnMobile] = useState(false);
  const [newPlayerCode, setNewPlayerCode] = useState<{ name: string; code: string } | null>(null);
  const wins = dashboardData.matches.filter((match) => match.home_score > match.away_score && match.status === "final").length;
  const losses = dashboardData.matches.filter((match) => match.home_score < match.away_score && match.status === "final").length;
  const featuredProducts = dashboardData.products.filter((product) => product.is_featured).length;

  useEffect(() => {
    document.body.classList.toggle("drawer-open", isMobileMenuOpen);
    return () => document.body.classList.remove("drawer-open");
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const session = getStoredPortalSession();

    if (!session) {
      window.location.href = "/login";
      return;
    }

    if (session.profile.role !== "coach") {
      window.location.href = "/player-dashboard";
      return;
    }

    loadDashboard(session).catch((error) => {
      console.error("Failed to load dashboard:", error);
      setFormError("Failed to load dashboard data. Using default view.");
      applyDashboardData(fallbackMagicData, session);
    });
  }, []);

  function applyDashboardData(data: MagicData, session?: PortalSession) {
    const profile = data.coachProfile;
    setDashboardData(data);
    setCoachName(profile?.full_name || session?.profile.full_name || "Coach");
    setCoachRole(profile?.role || "Coach");
    setClubName(profile?.club_name || "Magic Initiative Rwanda");
  }

  async function refreshDashboard() {
    const session = await requireFreshCoachSession();
    await loadDashboard(session);
  }

  async function loadDashboard(session: PortalSession) {
    try {
      const [data, coachProfile] = await Promise.all([
        getMagicData(session.access_token, true).catch((err) => {
          console.error("Failed to fetch magic data:", err);
          return fallbackMagicData;
        }),
        getCoachProfileForUser(session.user.id, session.access_token).catch((err) => {
          console.error("Failed to fetch coach profile:", err);
          return null;
        }),
      ]);

      applyDashboardData({ ...data, coachProfile }, session);
    } catch (error) {
      console.error("Error loading dashboard:", error);
      applyDashboardData(fallbackMagicData, session);
    }
  }

  async function runDashboardAction(action: () => Promise<void>, successMessage: string) {
    if (isSaving) return;

    setFormError("");
    setIsSaving(true);

    try {
      await action();
      window.alert(successMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save this item.";
      setFormError(message);
      window.alert(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEventCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const form = event.currentTarget;
    const payload = {
      title: String(data.get("title")),
      category: String(data.get("category")),
      event_date: String(data.get("eventDate")),
      event_time: String(data.get("eventTime") || "") || null,
      venue: String(data.get("venue")),
      description: String(data.get("description") || "") || null,
      is_published: true,
    };

    await runDashboardAction(async () => {
      if (editingEvent) {
        await updateEvent(editingEvent.id, payload);
      } else {
        await insertEvent(payload);
      }
      await refreshDashboard();
      setEditingEvent(null);
      setShowEventForm(false);
      form.reset();
    }, editingEvent ? "Event updated in Supabase." : "Event saved to Supabase and published.");
  }

  async function handleMatchCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const form = event.currentTarget;
    const payload = {
      match_date: String(data.get("matchDate")),
      opponent_name: String(data.get("opponentName")),
      home_score: Number(data.get("homeScore") || 0),
      away_score: Number(data.get("awayScore") || 0),
      venue: String(data.get("venue") || "") || null,
      league: String(data.get("league")),
      mvp_name: String(data.get("mvpName") || "") || null,
      status: "final" as const,
    };

    await runDashboardAction(async () => {
      if (editingMatch) {
        await updateMatch(editingMatch.id, payload);
      } else {
        await insertMatch(payload);
      }
      await refreshDashboard();
      setEditingMatch(null);
      setShowMatchForm(false);
      form.reset();
    }, editingMatch ? "Match updated in Supabase." : "Match saved to Supabase and standings updated.");
  }

  async function handlePlayerCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const form = event.currentTarget;

    await runDashboardAction(async () => {
      const session = await requireFreshCoachSession();
      const uploadedPhotoUrl = await uploadPhotoFile(data.get("playerPhoto"), "players", session?.access_token);
      const payload = {
        full_name: String(data.get("fullName")),
        jersey_number: Number(data.get("jerseyNumber") || 0),
        position: String(data.get("position")),
        height: String(data.get("height") || "") || null,
        bio: String(data.get("bio") || "") || null,
        photo_url: uploadedPhotoUrl || String(data.get("photoUrl") || "") || null,
        status: "active" as const,
      };

      if (editingPlayer) {
        await updatePlayer(editingPlayer.id, payload, session.access_token);
      } else {
        const result = await insertPlayer(payload, session.access_token);
        if (Array.isArray(result) && result[0]) {
          const newPlayer = result[0];
          setNewPlayerCode({ name: payload.full_name, code: newPlayer.registration_code });
          setTimeout(() => setNewPlayerCode(null), 8000);
        }
      }
      await refreshDashboard();
      setEditingPlayer(null);
      setShowPlayerForm(false);
      form.reset();
    }, editingPlayer ? "Player profile updated in Supabase." : "Player saved to Supabase and added to the roster.");
  }

  async function handleNewsCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("newsTitle"));
    const form = event.currentTarget;

    await runDashboardAction(async () => {
      const session = await requireFreshCoachSession();
      const uploadedImageUrls = await uploadPhotoFiles(data.getAll("newsImages"), "news", session?.access_token);
      const manualImageUrls = parseImageUrls(String(data.get("imageUrl") || ""));
      const payload = {
        title,
        slug: createSlug(title),
        category: String(data.get("newsCategory")),
        excerpt: String(data.get("excerpt") || "") || null,
        content: String(data.get("content") || "") || null,
        image_url: formatImageUrlsForStorage([...uploadedImageUrls, ...manualImageUrls]),
        published_at: editingNews?.published_at || new Date().toISOString(),
        is_published: true,
      };

      if (editingNews) {
        await updateNewsPost(editingNews.id, payload);
      } else {
        await insertNewsPost(payload);
      }
      await refreshDashboard();
      setEditingNews(null);
      setShowNewsForm(false);
      form.reset();
    }, editingNews ? "News post updated in Supabase." : "News post saved to Supabase and published.");
  }

  async function handleProductCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("productName")).trim();
    const price = Number(data.get("price") || 0);
    const form = event.currentTarget;

    await runDashboardAction(async () => {
      const session = await requireFreshCoachSession();
      const uploadedImageUrl = await uploadPhotoFile(data.get("productImage"), "products", session?.access_token);
      const payload = {
        name,
        slug: createSlug(name),
        category: String(data.get("productCategory") || "Merchandise"),
        description: String(data.get("description") || "") || null,
        price_cents: Math.round(price * 100),
        currency: String(data.get("currency") || "RWF"),
        image_url: uploadedImageUrl || String(data.get("imageUrl") || "") || null,
        inventory_count: Number(data.get("inventoryCount") || 0),
        is_featured: data.get("isFeatured") === "on",
        is_published: true,
      };
      const savedProducts = editingProduct
        ? await updateShopProduct(editingProduct.id, payload, session?.access_token)
        : await insertShopProduct(payload, session?.access_token);
      const savedProduct = savedProducts[0];

      if (savedProduct) {
        setDashboardData((current) => ({
          ...current,
          products: editingProduct
            ? current.products.map((product) => product.id === savedProduct.id ? savedProduct : product)
            : [savedProduct, ...current.products],
        }));
      }

      try {
        await refreshDashboard();
      } catch {
        // The product table already reflects the successful write.
      }

      if (editingProduct) {
        setEditingProduct(null);
      }
      setShowProductForm(false);
      form.reset();
    }, editingProduct ? "Product updated in Supabase." : "Product saved to Supabase and published in the shop.");
  }

  async function handleProfileUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const profile = dashboardData.coachProfile;

    await runDashboardAction(async () => {
      const session = await requireFreshCoachSession();
      const uploadedAvatarUrl = await uploadPhotoFile(data.get("avatarFile"), "avatars", session?.access_token);
      const payload = {
        full_name: String(data.get("coachName") || coachName),
        role: String(data.get("coachRole") || coachRole),
        club_name: String(data.get("clubName") || clubName),
        email: String(data.get("email") || "") || null,
        phone: String(data.get("phone") || "") || null,
        training_base: String(data.get("base") || "") || null,
        bio: String(data.get("bio") || "") || null,
        avatar_url: uploadedAvatarUrl || String(data.get("avatarUrl") || "") || null,
        auth_user_id: session.user.id,
      };

      if (profile) {
        await updateCoachProfile(profile.id, payload, session.access_token);
      } else {
        await insertCoachProfile(payload, session.access_token);
      }
      await refreshDashboard();
    }, "Profile settings saved to Supabase.");
  }

  async function handleNotificationCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    await runDashboardAction(async () => {
      const session = await requireFreshCoachSession();
      const payload = {
        recipient_player_id: notificationForm.selectedPlayer,
        sender_coach_id: dashboardData.coachProfile?.id || null,
        message: notificationForm.message,
        duration_days: notificationForm.duration,
      };

      await insertNotification(payload, session.access_token);
      await refreshDashboard();
      setNotificationForm({
        selectedPlayer: "",
        message: "",
        duration: 7,
      });
      setShowNotificationForm(false);
      form.reset();
    }, "Notification sent to player successfully.");
  }

  async function handleDelete(label: string, collection: CollectionKey, id: string, action: () => Promise<unknown>) {
    if (!window.confirm(`Delete this ${label}? This cannot be undone.`)) return;

    await runDashboardAction(async () => {
      await action();
      setDashboardData((current) => ({
        ...current,
        [collection]: current[collection].filter((item) => item.id !== id),
      }));

      try {
        await refreshDashboard();
      } catch {
        // The local table is already updated; a later dashboard refresh can retry the network read.
      }
    }, `${label.charAt(0).toUpperCase()}${label.slice(1)} deleted from Supabase.`);
  }

  function handleLogout() {
    clearPortalSession();
    window.location.href = "/login";
  }

  function selectPanel(panelId: PanelId) {
    setActivePanel(panelId);
    setIsMobileMenuOpen(false);
  }

  return (
    <main className={styles.page}>
      <header className={styles.mobileHeader}>
        <Link href="/" className={styles.mobileLogo} aria-label="Magic Initiative Rwanda home">
          <span className={styles.ball}>BB</span>
          <span className={styles.logoTitle}>Magic Initiative Rwanda</span>
        </Link>

        <div className={styles.mobileHeaderActions}>
          <Link href="/" className={styles.mobileHeaderLink}>Website</Link>
          <button
            className={styles.mobileIconButton}
            type="button"
            aria-label="Open dashboard menu"
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <i className="fa-solid fa-grip" aria-hidden="true" />
          </button>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className={styles.mobileMenuLayer} role="presentation" onMouseDown={() => setIsMobileMenuOpen(false)} />
      )}

      <aside className={`${styles.sidebar} ${isMobileMenuOpen ? styles.sidebarOpen : ""}`}>
        <Link href="/" className={styles.logo} aria-label="Magic Initiative Rwanda home">
          <span className={styles.ball}>🏀</span>
          <span className={styles.logoTitle}>Magic Initiative Rwanda</span>
        </Link>

        <div className={styles.mobileDrawerHead}>
          <span>Control Menu</span>
          <button type="button" aria-label="Close dashboard menu" onClick={() => setIsMobileMenuOpen(false)}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <span className={styles.menuTitle}>Management Engine</span>
        <ul className={styles.navList}>
          {panels.map((panel) => (
            <li key={panel.id}>
              <button
                type="button"
                className={`${styles.tabLink} ${activePanel === panel.id ? styles.activeTab : ""}`}
                onClick={() => selectPanel(panel.id)}
              >
                <i className={`fa-solid ${panel.icon}`} aria-hidden="true" />
                {panel.label}
              </button>
            </li>
          ))}
        </ul>

        <div className={styles.sidebarFooter}>
          <p>Access level: {coachRole}</p>
          <button type="button" className={styles.logoutButton} onClick={handleLogout}>Sign Out</button>
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

        {!showStatsOnMobile && (
          <button 
            className={styles.toggleStatsButton} 
            onClick={() => setShowStatsOnMobile(true)}
            aria-label="Show statistics"
          >
            <i className="fa-solid fa-chevron-down" />
            Show Statistics
          </button>
        )}

        {showStatsOnMobile && (
          <button 
            className={styles.toggleStatsButton} 
            onClick={() => setShowStatsOnMobile(false)}
            aria-label="Hide statistics"
          >
            <i className="fa-solid fa-chevron-up" />
            Hide Statistics
          </button>
        )}

        <section className={`${styles.analyticsStrip} ${showStatsOnMobile ? styles.statsVisible : ""}`} aria-label="Team summary">
          <div className={styles.analyticCard}><span>Total Wins</span><h3>{wins}</h3></div>
          <div className={styles.analyticCard}><span>Loss Record</span><h3>{losses}</h3></div>
          <div className={styles.analyticCard}><span>Active Roster</span><h3>{dashboardData.players.length}</h3></div>
          <div className={styles.analyticCard}><span>Shop Products</span><h3>{dashboardData.products.length}</h3><p>{featuredProducts} featured</p></div>
        </section>

        {showStatsOnMobile && (
          <button 
            className={styles.toggleStatsButton} 
            onClick={() => setShowStatsOnMobile(false)}
            aria-label="Hide statistics"
          >
            <i className="fa-solid fa-chevron-up" />
            Hide Statistics
          </button>
        )}

        <section className={`${styles.panel} ${activePanel === "events" ? styles.activePanel : ""}`}>
          <PanelHeader
            title="New Events"
            buttonLabel="Add New Event"
            onButtonClick={() => {
              setEditingEvent(null);
              setShowEventForm(true);
            }}
          />

          {showEventForm && (
            <form onSubmit={handleEventCreate} key={editingEvent?.id || "new-event"} className={styles.editorForm}>
              <div className={styles.formGrid}>
              <InputBox label="Event Headline Title"><input name="title" type="text" placeholder="Eastern Conference Finals Warm-up" defaultValue={editingEvent?.title || ""} required /></InputBox>
              <InputBox label="Event Category Type">
                <select name="category" defaultValue={editingEvent?.category || "League Match"}>
                  <option>League Match</option>
                  <option>Charity Cup Tournament</option>
                  <option>Fan Meet & Greet Session</option>
                  <option>Open Press Practice</option>
                </select>
              </InputBox>
              <InputBox label="Calendar Date"><input name="eventDate" type="date" defaultValue={editingEvent?.event_date || ""} required /></InputBox>
              <InputBox label="Tip-off Time"><input name="eventTime" type="time" defaultValue={editingEvent?.event_time || ""} required /></InputBox>
              <InputBox label="Arena Venue Location"><input name="venue" type="text" placeholder="BK Arena, Court A" defaultValue={editingEvent?.venue || ""} required /></InputBox>
              <InputBox label="Event Description" full><textarea name="description" rows={4} placeholder="Short event details for fans..." defaultValue={editingEvent?.description || ""} /></InputBox>
            </div>
            <div className={styles.actionBar}>
              <button type="button" className={styles.secondaryButton} onClick={() => { setShowEventForm(false); setEditingEvent(null); }}>Cancel</button>
              <button type="submit" className={styles.primaryButton} disabled={isSaving}>{editingEvent ? "Update Event" : "Publish Event"}</button>
            </div>
          </form>
          )}

          <div className={styles.tableScroll}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Venue</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.events.map((eventItem) => (
                  <tr key={eventItem.id}>
                    <td>{eventItem.title}</td>
                    <td>{eventItem.category}</td>
                    <td>
                      {formatDisplayDate(eventItem.event_date)}
                      <EventCountdown eventDate={eventItem.event_date} eventTime={eventItem.event_time} compact />
                    </td>
                    <td>{eventItem.venue}</td>
                    <td>
                      <RowActions
                        onEdit={() => { setEditingEvent(eventItem); setShowEventForm(true); }}
                        onDelete={() => handleDelete("event", "events", eventItem.id, () => deleteEvent(eventItem.id))}
                      />
                    </td>
                  </tr>
                ))}
                {dashboardData.events.length === 0 && (
                  <tr><td colSpan={5}>No events have been published yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${styles.panel} ${activePanel === "matches" ? styles.activePanel : ""}`}>
          <PanelHeader
            title="Matches"
            buttonLabel="Add Match"
            onButtonClick={() => {
              setEditingMatch(null);
              setShowMatchForm(true);
            }}
          />

          {showMatchForm && (
          <form onSubmit={handleMatchCreate} key={editingMatch?.id || "new-match"} className={styles.editorForm}>
            <div className={styles.formGrid}>
              <InputBox label="Opponent Club Name"><input name="opponentName" type="text" placeholder="Kigali Titans" defaultValue={editingMatch?.opponent_name || ""} required /></InputBox>
              <InputBox label="League Match Context">
                <select name="league" defaultValue={editingMatch?.league || "League"}>
                  <option>League</option>
                  <option>Regular Season</option>
                  <option>Playoffs</option>
                  <option>Pre-season Tournament</option>
                </select>
              </InputBox>
              <InputBox label="Match Date"><input name="matchDate" type="date" defaultValue={editingMatch?.match_date || ""} required /></InputBox>
              <InputBox label="Arena Venue"><input name="venue" type="text" placeholder="BK Arena" defaultValue={editingMatch?.venue || ""} /></InputBox>
              <InputBox label="Magic Initiative Rwanda Score"><input name="homeScore" type="number" placeholder="112" defaultValue={editingMatch?.home_score ?? ""} required /></InputBox>
              <InputBox label="Opponent Score"><input name="awayScore" type="number" placeholder="104" defaultValue={editingMatch?.away_score ?? ""} required /></InputBox>
              <InputBox label="Game MVP Player" full><input name="mvpName" type="text" placeholder="Aiden Foster" defaultValue={editingMatch?.mvp_name || ""} /></InputBox>
            </div>
            <div className={styles.actionBar}>
              <button type="button" className={styles.secondaryButton} onClick={() => { setShowMatchForm(false); setEditingMatch(null); }}>Cancel</button>
              <button type="submit" className={styles.primaryButton} disabled={isSaving}>{editingMatch ? "Update Match" : "Commit Match Scores"}</button>
            </div>
          </form>
          )}

          <EditableMatchesTable
            matches={dashboardData.matches}
            onEdit={(match) => { setEditingMatch(match); setShowMatchForm(true); }}
            onDelete={(match) => handleDelete("match", "matches", match.id, () => deleteMatch(match.id))}
          />
        </section>

        <section className={`${styles.panel} ${activePanel === "players" ? styles.activePanel : ""}`}>
          <PanelHeader
            title="Players"
            buttonLabel="Add Player"
            onButtonClick={() => {
              setEditingPlayer(null);
              setShowPlayerForm(true);
            }}
          />

          {newPlayerCode && (
            <div style={{
              backgroundColor: "#e64a1920",
              border: "1px solid #e64a19",
              borderRadius: "6px",
              padding: "16px",
              marginBottom: "16px",
              animation: "slideIn 0.3s ease-out"
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ margin: "0 0 8px 0", fontWeight: "600", color: "#11171e" }}>
                    ✓ Player Added: <strong>{newPlayerCode.name}</strong>
                  </p>
                  <p style={{ margin: "0", fontSize: "13px", color: "#666" }}>
                    Share this code with the player to register:
                  </p>
                  <code style={{
                    display: "inline-block",
                    marginTop: "8px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    backgroundColor: "#ffffff",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    letterSpacing: "2px",
                    fontFamily: "monospace",
                    color: "#e64a19"
                  }}>
                    {newPlayerCode.code}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(newPlayerCode.code);
                    alert(`Copied: ${newPlayerCode.code}`);
                  }}
                  style={{
                    background: "#e64a19",
                    color: "white",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "12px"
                  }}
                >
                  Copy Code
                </button>
              </div>
            </div>
          )}

          {showPlayerForm && (
          <form onSubmit={handlePlayerCreate} key={editingPlayer?.id || "new-player"} className={styles.editorForm}>
            <div className={styles.formGrid}>
              <InputBox label="Full Player Name"><input name="fullName" type="text" placeholder="Jayson Tatum" defaultValue={editingPlayer?.full_name || ""} required /></InputBox>
              <InputBox label="Jersey Number Allocation"><input name="jerseyNumber" type="number" placeholder="0" max="99" defaultValue={editingPlayer?.jersey_number ?? ""} required /></InputBox>
              <InputBox label="Court Position Role">
                <select name="position" defaultValue={editingPlayer?.position || "Point Guard (PG)"}>
                  <option>Point Guard (PG)</option>
                  <option>Shooting Guard (SG)</option>
                  <option>Small Forward (SF)</option>
                  <option>Power Forward (PF)</option>
                  <option>Center (C)</option>
                </select>
              </InputBox>
              <InputBox label="Height Metric Profile"><input name="height" type="text" placeholder={"6'8\""} defaultValue={editingPlayer?.height || ""} /></InputBox>
              <InputBox label="Photo URL"><input name="photoUrl" type="url" placeholder="https://..." defaultValue={editingPlayer?.photo_url || ""} /></InputBox>
              <InputBox label="Upload Player Photo"><input name="playerPhoto" type="file" accept="image/jpeg,image/png,image/webp,image/gif" /></InputBox>
              <InputBox label="Biographical Scouting Summary Notes" full>
                <textarea name="bio" rows={4} placeholder="Enter performance highlights or metrics information details..." defaultValue={editingPlayer?.bio || ""} />
              </InputBox>
            </div>
            <div className={styles.actionBar}>
              <button type="button" className={styles.secondaryButton} onClick={() => { setShowPlayerForm(false); setEditingPlayer(null); }}>Cancel</button>
              <button type="submit" className={styles.primaryButton} disabled={isSaving}>{editingPlayer ? "Update Player" : "Register Player Profile"}</button>
            </div>
          </form>
          )}

          <div className={styles.tableScroll}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>No.</th>
                  <th>Position</th>
                  <th>Height</th>
                  <th>Registration Code</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.players.map((player) => (
                  <tr key={player.id}>
                    <td>{player.full_name}</td>
                    <td>{player.jersey_number}</td>
                    <td>{player.position}</td>
                    <td>{player.height || "-"}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <code style={{ fontSize: "12px", fontWeight: "bold", backgroundColor: "#f0f0f0", padding: "4px 8px", borderRadius: "4px", cursor: "pointer" }} title="Click to copy" onClick={() => {
                          navigator.clipboard.writeText(player.registration_code);
                          alert(`Copied: ${player.registration_code}`);
                        }}>
                          {player.registration_code}
                        </code>
                        <button
                          type="button"
                          title="Copy to clipboard"
                          onClick={() => {
                            navigator.clipboard.writeText(player.registration_code);
                            alert(`Copied: ${player.registration_code}`);
                          }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#e64a19", fontSize: "14px", padding: "4px" }}
                        >
                          📋
                        </button>
                      </div>
                      {player.is_registered && <span style={{ marginLeft: "8px", color: "green", fontSize: "12px" }}>✓ Registered</span>}
                    </td>
                    <td>{player.status}</td>
                    <td>
                      <RowActions
                        onEdit={() => { setEditingPlayer(player); setShowPlayerForm(true); }}
                        onDelete={() => handleDelete("player", "players", player.id, async () => {
                          const session = await requireFreshCoachSession();
                          return deletePlayerFully(player.id, session.access_token);
                        })}
                      />
                    </td>
                  </tr>
                ))}
                {dashboardData.players.length === 0 && (
                  <tr><td colSpan={7}>No players have been added yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${styles.panel} ${activePanel === "news" ? styles.activePanel : ""}`}>
          <PanelHeader
            title="News"
            buttonLabel="Publish News"
            onButtonClick={() => {
              setEditingNews(null);
              setShowNewsForm(true);
            }}
          />

          {showNewsForm && (
          <form onSubmit={handleNewsCreate} key={editingNews?.id || "new-news"} className={styles.editorForm}>
            <div className={styles.formGrid}>
              <InputBox label="News Title"><input name="newsTitle" type="text" placeholder="Magic Initiative Rwanda prepares for playoff push" defaultValue={editingNews?.title || ""} required /></InputBox>
              <InputBox label="Category"><input name="newsCategory" type="text" defaultValue={editingNews?.category || "Club"} required /></InputBox>
              <InputBox label="Feature Image URLs"><input name="imageUrl" type="text" placeholder={'"https://...","https://..."'} defaultValue={editingNews?.image_url || ""} /></InputBox>
              <InputBox label="Upload Feature Images"><input name="newsImages" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple /></InputBox>
              <InputBox label="Excerpt"><input name="excerpt" type="text" placeholder="Short summary for cards..." defaultValue={editingNews?.excerpt || ""} /></InputBox>
              <InputBox label="Content" full><textarea name="content" rows={5} placeholder="Full article text..." defaultValue={editingNews?.content || ""} /></InputBox>
            </div>
            <div className={styles.actionBar}>
              <button type="button" className={styles.secondaryButton} onClick={() => { setShowNewsForm(false); setEditingNews(null); }}>Cancel</button>
              <button type="submit" className={styles.primaryButton} disabled={isSaving}>{editingNews ? "Update News" : "Publish News"}</button>
            </div>
          </form>
          )}

          <div className={styles.tableScroll}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Published</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.news.map((post) => (
                  <tr key={post.id}>
                    <td>{post.title}</td>
                    <td>{post.category}</td>
                    <td>{formatDisplayDate(post.published_at)}</td>
                    <td>{post.is_published ? "Published" : "Draft"}</td>
                    <td>
                      <RowActions
                        onEdit={() => { setEditingNews(post); setShowNewsForm(true); }}
                        onDelete={() => handleDelete("news post", "news", post.id, () => deleteNewsPost(post.id))}
                      />
                    </td>
                  </tr>
                ))}
                {dashboardData.news.length === 0 && (
                  <tr><td colSpan={5}>No news has been published yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${styles.panel} ${activePanel === "products" ? styles.activePanel : ""}`}>
          <PanelHeader
            title="Shop Products"
            buttonLabel="Add Product"
            onButtonClick={() => {
              setEditingProduct(null);
              setShowProductForm(true);
            }}
          />

          {showProductForm && (
          <form onSubmit={handleProductCreate} key={editingProduct?.id || "new-product"} className={styles.editorForm}>
            <div className={styles.formGrid}>
              <InputBox label="Product Name"><input name="productName" type="text" placeholder="Magic Initiative Rwanda Black T-Shirt" defaultValue={editingProduct?.name || ""} required /></InputBox>
              <InputBox label="Category"><input name="productCategory" type="text" defaultValue={editingProduct?.category || "T-Shirts"} required /></InputBox>
              <InputBox label="Price"><input name="price" type="number" min="0" step="1" placeholder="18000" defaultValue={editingProduct ? editingProduct.price_cents / 100 : ""} required /></InputBox>
              <InputBox label="Currency">
                <select name="currency" defaultValue={editingProduct?.currency || "RWF"}>
                  <option>RWF</option>
                  <option>USD</option>
                </select>
              </InputBox>
              <InputBox label="Inventory Count"><input name="inventoryCount" type="number" min="0" placeholder="40" defaultValue={editingProduct?.inventory_count ?? ""} required /></InputBox>
              <InputBox label="Image URL"><input name="imageUrl" type="url" placeholder="https://..." defaultValue={editingProduct?.image_url || ""} /></InputBox>
              <InputBox label="Upload Image"><input name="productImage" type="file" accept="image/jpeg,image/png,image/webp,image/gif" /></InputBox>
              <InputBox label="Description" full><textarea name="description" rows={4} placeholder="Short product details..." defaultValue={editingProduct?.description || ""} /></InputBox>
              <label className={styles.checkboxBox}>
                <input name="isFeatured" type="checkbox" defaultChecked={editingProduct?.is_featured || false} />
                <span>Feature this product first in the shop</span>
              </label>
            </div>
            <div className={styles.actionBar}>
              <button type="button" className={styles.secondaryButton} onClick={() => { setShowProductForm(false); setEditingProduct(null); }}>Cancel</button>
              <button type="submit" className={styles.primaryButton} disabled={isSaving}>{editingProduct ? "Update Product" : "Publish Product"}</button>
            </div>
          </form>
          )}

          <div className={styles.tableSection}>
            <h3>Published Products</h3>
            <div className={styles.tableScroll}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Featured</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.products.map((product) => (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td>{product.category}</td>
                      <td>{formatMoney(product.price_cents, product.currency)}</td>
                      <td>{product.inventory_count}</td>
                      <td>{product.is_featured ? "Yes" : "No"}</td>
                      <td>
                        <RowActions
                          onEdit={() => { setEditingProduct(product); setShowProductForm(true); }}
                          onDelete={() => {
                            return handleDelete("product", "products", product.id, async () => {
                              const session = await requireFreshCoachSession();
                              return deleteShopProduct(product.id, session.access_token);
                            });
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                  {dashboardData.products.length === 0 && (
                    <tr>
                      <td colSpan={6}>No products have been published yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className={`${styles.panel} ${activePanel === "notifications" ? styles.activePanel : ""}`}>
          <PanelHeader
            title="Notifications"
            buttonLabel="Send Notification"
            onButtonClick={() => {
              setShowNotificationForm(true);
            }}
          />

          {showNotificationForm && (
          <form onSubmit={handleNotificationCreate} className={styles.editorForm}>
            <div className={styles.formGrid}>
              <InputBox label="Select Player">
                <select 
                  name="selectedPlayer" 
                  value={notificationForm.selectedPlayer}
                  onChange={(e) => setNotificationForm({ ...notificationForm, selectedPlayer: e.target.value })}
                  required
                >
                  <option value="">Choose a player...</option>
                  {dashboardData.players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.full_name} (#{player.jersey_number})
                    </option>
                  ))}
                </select>
              </InputBox>
              <InputBox label="Duration (Days)">
                <input 
                  name="duration" 
                  type="number" 
                  min="1" 
                  max="365"
                  value={notificationForm.duration}
                  onChange={(e) => setNotificationForm({ ...notificationForm, duration: Number(e.target.value) })}
                  required 
                />
              </InputBox>
              <InputBox label="Message" full>
                <textarea 
                  name="message"
                  rows={4} 
                  placeholder="Type your message to the player..."
                  value={notificationForm.message}
                  onChange={(e) => setNotificationForm({ ...notificationForm, message: e.target.value })}
                  required
                />
              </InputBox>
            </div>
            <div className={styles.actionBar}>
              <button type="button" className={styles.secondaryButton} onClick={() => { setShowNotificationForm(false); }}>Cancel</button>
              <button type="submit" className={styles.primaryButton} disabled={isSaving}>Send Notification</button>
            </div>
          </form>
          )}

          <div className={styles.tableScroll}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Message</th>
                  <th>Sent</th>
                  <th>Expires</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.notifications.map((notification) => {
                  const recipient = dashboardData.players.find(p => p.id === notification.recipient_player_id);
                  const isExpired = new Date(notification.expires_at) < new Date();
                  
                  return (
                    <tr key={notification.id}>
                      <td>{recipient?.full_name || "Unknown Player"}</td>
                      <td>{notification.message.substring(0, 50)}{notification.message.length > 50 ? "..." : ""}</td>
                      <td>{formatDisplayDate(notification.created_at)}</td>
                      <td>{formatDisplayDate(notification.expires_at)}</td>
                      <td>{isExpired ? "Expired" : "Active"}</td>
                    </tr>
                  );
                })}
                {dashboardData.notifications.length === 0 && (
                  <tr><td colSpan={5}>No notifications sent yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
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
                    status={match.home_score > match.away_score ? "Win" : match.home_score < match.away_score ? "Loss" : "Draw"}
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
              <InputBox label="Upload Avatar"><input name="avatarFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif" /></InputBox>
              <InputBox label="Short Bio" full>
                <textarea name="bio" rows={4} defaultValue={dashboardData.coachProfile?.bio || ""} />
              </InputBox>
            </div>
            <div className={styles.actionBar}><button type="submit" className={styles.primaryButton} disabled={isSaving}>Save Profile Settings</button></div>
          </form>
        </section>
      </section>
    </main>
  );
}

function formatMoney(priceCents: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(priceCents / 100);
}

/**
 * Compress an image file using the Canvas API before uploading.
 *
 * Strategy:
 *  - Max dimension: 1280px on the longest side (keeps display crisp on retina
 *    screens while cutting file size dramatically vs original).
 *  - Output format: WebP at quality 0.82 — excellent visual quality at
 *    roughly 60-75% smaller than the equivalent JPEG.
 *  - GIFs are returned as-is (canvas flattens animations).
 *  - Falls back to the original file if the Canvas API is unavailable or
 *    if compression somehow produces a larger blob than the original.
 */
async function compressImage(
  file: File,
  { maxDimension = 1280, quality = 0.82 }: { maxDimension?: number; quality?: number } = {},
): Promise<File> {
  // Skip GIFs — canvas destroys animation frames.
  if (file.type === "image/gif") return file;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const { naturalWidth: w, naturalHeight: h } = img;
      const scale = Math.min(1, maxDimension / Math.max(w, h));
      const targetW = Math.round(w * scale);
      const targetH = Math.round(h * scale);

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;

      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }

      ctx.drawImage(img, 0, 0, targetW, targetH);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            // Compression made it bigger (can happen with tiny PNGs) — keep original.
            resolve(file);
            return;
          }
          const baseName = file.name.replace(/\.[^.]+$/, "");
          resolve(new File([blob], `${baseName}.webp`, { type: "image/webp" }));
        },
        "image/webp",
        quality,
      );
    };

    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}

async function uploadPhotoFile(fileValue: FormDataEntryValue | null, folder: string, accessToken?: string) {
  if (!(fileValue instanceof File) || fileValue.size === 0) return "";

  if (!supabaseUrl || !supabaseKey || !accessToken) {
    throw new Error("Sign in again before uploading a product image.");
  }

  // Compress before uploading — converts to WebP ≤ 1280px longest side.
  const compressed = await compressImage(fileValue);

  const baseName = createSlug(compressed.name.replace(/\.[^.]+$/, "")) || "upload";
  const ext = compressed.type === "image/webp" ? ".webp" : extensionFor(fileValue);
  const objectPath = `${folder}/${Date.now()}-${baseName}${ext}`;

  const response = await fetch(`${supabaseUrl}/storage/v1/object/${uploadBucket}/${objectPath}`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": compressed.type,
      "x-upsert": "false",
    },
    body: compressed,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string; error?: string } | null;
    throw new Error(body?.message || body?.error || `Supabase upload failed: ${response.status}`);
  }

  return `${supabaseUrl}/storage/v1/object/public/${uploadBucket}/${objectPath}`;
}

async function uploadPhotoFiles(fileValues: FormDataEntryValue[], folder: string, accessToken?: string) {
  const uploadedUrls: string[] = [];

  for (const fileValue of fileValues) {
    const uploadedUrl = await uploadPhotoFile(fileValue, folder, accessToken);
    if (uploadedUrl) uploadedUrls.push(uploadedUrl);
  }

  return uploadedUrls;
}

function extensionFor(file: File) {
  const extension = file.name.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase();
  if (extension && [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extension)) {
    return extension === ".jpeg" ? ".jpg" : extension;
  }

  const mimeExtension = file.type.split("/")[1];
  return mimeExtension ? `.${mimeExtension}` : ".jpg";
}

async function requireFreshCoachSession() {
  const session = await getFreshPortalSession();

  if (!session) {
    window.location.href = "/login";
    throw new Error("Your session expired. Please sign in again.");
  }

  if (session.profile.role !== "coach") {
    window.location.href = "/player-dashboard";
    throw new Error("Only coaches can manage this dashboard.");
  }

  return session;
}

function PanelHeader({
  title,
  buttonLabel,
  onButtonClick,
}: {
  title: string;
  buttonLabel: string;
  onButtonClick: () => void;
}) {
  return (
    <div className={styles.panelHeader}>
      <button type="button" className={styles.primaryButton} onClick={onButtonClick}>
        {buttonLabel}
      </button>
      <h2 className={styles.panelHeading}>{title}</h2>
    </div>
  );
}

function RowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={styles.rowActions}>
      <button type="button" className={styles.tableButton} onClick={onEdit}>Edit</button>
      <button type="button" className={styles.dangerButton} onClick={onDelete}>Delete</button>
    </div>
  );
}

function EditableMatchesTable({
  matches,
  onEdit,
  onDelete,
}: {
  matches: Match[];
  onEdit: (match: Match) => void;
  onDelete: (match: Match) => void;
}) {
  return (
    <div className={styles.tableScroll}>
      <table className={styles.dataTable}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Opponent</th>
            <th>Score</th>
            <th>League</th>
            <th>MVP</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => (
            <tr key={match.id}>
              <td>{formatDisplayDate(match.match_date)}</td>
              <td>{match.opponent_name || "-"}</td>
              <td>{match.home_score} - {match.away_score}</td>
              <td>{match.league}</td>
              <td>{match.mvp_name || "-"}</td>
              <td><RowActions onEdit={() => onEdit(match)} onDelete={() => onDelete(match)} /></td>
            </tr>
          ))}
          {matches.length === 0 && (
            <tr><td colSpan={6}>No matches have been added yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
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
  status: "Win" | "Loss" | "Draw";
  mvp: string;
}) {
  const getBadgeClass = () => {
    if (status === "Win") return styles.badgeWin;
    if (status === "Loss") return styles.badgeLoss;
    return styles.badgeDraw;
  };

  return (
    <tr>
      <td>{date}</td>
      <td>{opponent}</td>
      <td>{score}</td>
      <td><span className={`${styles.badgeStatus} ${getBadgeClass()}`}>{status}</span></td>
      <td>{mvp}</td>
    </tr>
  );
}
