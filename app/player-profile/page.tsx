"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPlayerProfileWithPortal, type Player } from "@/lib/magic-data";
import { dashboardPath, getFreshPortalSession, getStoredPortalSession, type PortalProfile, type PortalSession } from "@/lib/portal-auth";
import authStyles from "../login/login.module.css";
import styles from "./player-profile.module.css";

type ProfileData = {
  player: Player;
  portalProfile: PortalProfile | null;
};

export default function PlayerProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [session, setSession] = useState<PortalSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const storedSession = getStoredPortalSession();
        if (!storedSession || storedSession.profile.role !== "player") {
          window.location.href = "/login";
          return;
        }

        const freshSession = await getFreshPortalSession();

        if (!freshSession) {
          window.location.href = "/login";
          return;
        }

        setSession(freshSession);

        if (freshSession.profile.player_id) {
          const profileData = await getPlayerProfileWithPortal(
            freshSession.profile.player_id,
            freshSession.access_token
          );

          if (profileData) {
            setProfile(profileData);
          } else {
            setError("Could not load player profile data.");
          }
        } else {
          setError("No player record linked to your account.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  const pageClassName = `${authStyles.page} ${styles.profilePage}`;

  if (loading) {
    return (
      <main className={pageClassName}>
        <Link href="/" className={authStyles.logo} aria-label="Magic Initiative Rwanda home">
          <span className={authStyles.ball}>🏀</span>
          <span className={authStyles.title}>Magic Initiative Rwanda</span>
        </Link>
        <section className={`${authStyles.card} ${styles.profileCard}`}>
          <p style={{ textAlign: "center", color: "#a0aab2" }}>Loading profile...</p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className={pageClassName}>
        <Link href="/" className={authStyles.logo} aria-label="Magic Initiative Rwanda home">
          <span className={authStyles.ball}>🏀</span>
          <span className={authStyles.title}>Magic Initiative Rwanda</span>
        </Link>
        <section className={`${authStyles.card} ${styles.profileCard}`}>
          <p style={{ color: "#e64a19", textAlign: "center" }}>⚠️ {error}</p>
          <Link href={session ? dashboardPath(session.profile.role) : "/login"} className={authStyles.submit} style={{ display: "inline-block", textDecoration: "none", marginTop: "20px", textAlign: "center", width: "100%" }}>
            Back to Dashboard
          </Link>
        </section>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className={pageClassName}>
        <Link href="/" className={authStyles.logo} aria-label="Magic Initiative Rwanda home">
          <span className={authStyles.ball}>🏀</span>
          <span className={authStyles.title}>Magic Initiative Rwanda</span>
        </Link>
        <section className={`${authStyles.card} ${styles.profileCard}`}>
          <p style={{ textAlign: "center", color: "#a0aab2" }}>No profile data available</p>
        </section>
      </main>
    );
  }

  const { player, portalProfile } = profile;
  const playerStatus = player.status ? `${player.status.charAt(0).toUpperCase()}${player.status.slice(1)}` : "Unknown";
  const accountRole = portalProfile?.role
    ? `${portalProfile.role.charAt(0).toUpperCase()}${portalProfile.role.slice(1)}`
    : "Player";

  return (
    <main className={pageClassName}>
      <Link href="/" className={authStyles.logo} aria-label="Magic Initiative Rwanda home">
        <span className={authStyles.ball}>🏀</span>
        <span className={authStyles.title}>Magic Initiative Rwanda</span>
      </Link>

      <section className={`${authStyles.card} ${styles.profileCard}`}>
        <h1 className={`${authStyles.heading} ${styles.profileHeading}`}>Your Profile</h1>

        {player.photo_url && (
          <div className={styles.avatarWrap}>
            <img className={styles.avatar} src={player.photo_url} alt={player.full_name} />
          </div>
        )}

        <div className={styles.infoPanel}>
          <h2 className={styles.panelTitle}>📋 Player Information</h2>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Player Name</span>
              <p className={styles.infoValue}>{player.full_name}</p>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Position</span>
              <p className={`${styles.infoValue} ${styles.positionValue}`}>{player.position || "-"}</p>
            </div>
            <div className={styles.metaRow}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Jersey Number</span>
                <p className={styles.infoValue}>#{player.jersey_number || "-"}</p>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Height</span>
                <p className={styles.infoValue}>{player.height || "-"}</p>
              </div>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Status</span>
              <p className={styles.infoValue} style={{ color: player.status === "active" ? "#218739" : "#89929a" }}>{playerStatus}</p>
            </div>
            {player.bio && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Bio</span>
                <p className={`${styles.infoValue} ${styles.bioValue}`}>{player.bio}</p>
              </div>
            )}
          </div>
        </div>

        <div className={`${styles.infoPanel} ${styles.accountPanel}`}>
          <h2 className={styles.panelTitle}>🔐 Portal Account</h2>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Account Email</span>
              <p className={`${styles.infoValue} ${styles.emailValue}`}>{portalProfile?.email || player.email || "Not set"}</p>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Display Name</span>
              <p className={styles.infoValue}>{portalProfile?.full_name || player.full_name}</p>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Account Role</span>
              <p className={`${styles.infoValue} ${styles.roleValue}`}>{accountRole}</p>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Registration Code</span>
              <div className={styles.registrationRow}>
                <code className={styles.registrationCode}>{player.registration_code || "-"}</code>
                <span className={styles.registered}>✓ Registered</span>
              </div>
            </div>
            {portalProfile?.created_at && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Account Created</span>
                <p className={styles.infoValue}>{new Date(portalProfile.created_at).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        </div>

        <div className={styles.verifiedNotice}>
          <p>✓ <strong>Account Verified:</strong> Your player record and portal account are linked and synchronized.</p>
        </div>

        <Link href={session ? dashboardPath(session.profile.role) : "/login"} className={authStyles.submit} style={{ display: "block", textDecoration: "none", textAlign: "center" }}>
          Back to Dashboard
        </Link>
      </section>

      <Link href="/" className={authStyles.backHome}>Back to website</Link>
    </main>
  );
}
