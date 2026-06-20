"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPlayerProfileWithPortal } from "@/lib/magic-data";
import { dashboardPath, getFreshPortalSession, getStoredPortalSession, type PortalSession } from "@/lib/portal-auth";
import styles from "../login/login.module.css";

type ProfileData = {
  player: any;
  portalProfile: any;
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

        // Get player profile - use portal profile's player_id
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

  if (loading) {
    return (
      <main className={styles.page}>
        <Link href="/" className={styles.logo} aria-label="Magic Initiative Rwanda home">
          <span className={styles.ball}>🏀</span>
          <span className={styles.title}>Magic Initiative Rwanda</span>
        </Link>
        <section className={styles.card}>
          <p style={{ textAlign: "center", color: "#a0aab2" }}>Loading profile...</p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className={styles.page}>
        <Link href="/" className={styles.logo} aria-label="Magic Initiative Rwanda home">
          <span className={styles.ball}>🏀</span>
          <span className={styles.title}>Magic Initiative Rwanda</span>
        </Link>
        <section className={styles.card}>
          <p style={{ color: "#e64a19", textAlign: "center" }}>⚠️ {error}</p>
          <Link href={session ? dashboardPath(session.profile.role) : "/login"} className={styles.submit} style={{ display: "inline-block", textDecoration: "none", marginTop: "20px", textAlign: "center", width: "100%" }}>
            Back to Dashboard
          </Link>
        </section>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className={styles.page}>
        <Link href="/" className={styles.logo} aria-label="Magic Initiative Rwanda home">
          <span className={styles.ball}>🏀</span>
          <span className={styles.title}>Magic Initiative Rwanda</span>
        </Link>
        <section className={styles.card}>
          <p style={{ textAlign: "center", color: "#a0aab2" }}>No profile data available</p>
        </section>
      </main>
    );
  }

  const { player, portalProfile } = profile;

  return (
    <main className={styles.page}>
      <Link href="/" className={styles.logo} aria-label="Magic Initiative Rwanda home">
        <span className={styles.ball}>🏀</span>
        <span className={styles.title}>Magic Initiative Rwanda</span>
      </Link>

      <section className={styles.card} style={{ maxWidth: "500px" }}>
        <h1 className={styles.heading}>Your Profile</h1>
        
        {player.photo_url && (
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <img
              src={player.photo_url}
              alt={player.full_name}
              style={{
                width: "120px",
                height: "120px",
                borderRadius: "50%",
                objectFit: "cover",
                border: "3px solid #e64a19"
              }}
            />
          </div>
        )}

        <div style={{ backgroundColor: "#f5f5f5", borderRadius: "8px", padding: "16px", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: "600", color: "#666", marginTop: "0", marginBottom: "12px", textTransform: "uppercase" }}>
            📋 Player Information (players table)
          </h2>
          <div style={{ display: "grid", gap: "12px", fontSize: "14px" }}>
            <div>
              <span style={{ color: "#999", fontSize: "12px" }}>Player Name</span>
              <p style={{ margin: "4px 0 0 0", fontWeight: "600", color: "#11171e" }}>{player.full_name}</p>
            </div>
            <div>
              <span style={{ color: "#999", fontSize: "12px" }}>Position</span>
              <p style={{ margin: "4px 0 0 0", fontWeight: "600", color: "#e64a19" }}>{player.position}</p>
            </div>
            <div style={{ display: "flex", gap: "16px" }}>
              <div style={{ flex: 1 }}>
                <span style={{ color: "#999", fontSize: "12px" }}>Jersey Number</span>
                <p style={{ margin: "4px 0 0 0", fontWeight: "600" }}>#{player.jersey_number}</p>
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ color: "#999", fontSize: "12px" }}>Height</span>
                <p style={{ margin: "4px 0 0 0", fontWeight: "600" }}>{player.height || "-"}</p>
              </div>
            </div>
            <div>
              <span style={{ color: "#999", fontSize: "12px" }}>Status</span>
              <p style={{ margin: "4px 0 0 0", fontWeight: "600", color: player.status === "active" ? "green" : "#999" }}>
                {player.status.charAt(0).toUpperCase() + player.status.slice(1)}
              </p>
            </div>
            {player.bio && (
              <div>
                <span style={{ color: "#999", fontSize: "12px" }}>Bio</span>
                <p style={{ margin: "4px 0 0 0", color: "#666" }}>{player.bio}</p>
              </div>
            )}
          </div>
        </div>

        <div style={{ backgroundColor: "#e64a1910", borderRadius: "8px", padding: "16px", marginBottom: "20px", border: "1px solid #e64a1930" }}>
          <h2 style={{ fontSize: "14px", fontWeight: "600", color: "#e64a19", marginTop: "0", marginBottom: "12px", textTransform: "uppercase" }}>
            🔐 Portal Account (portal_profiles table)
          </h2>
          <div style={{ display: "grid", gap: "12px", fontSize: "14px" }}>
            <div>
              <span style={{ color: "#999", fontSize: "12px" }}>Account Email</span>
              <p style={{ margin: "4px 0 0 0", fontWeight: "600", color: "#11171e", wordBreak: "break-all" }}>
                {portalProfile?.email || player.email || "Not set"}
              </p>
            </div>
            <div>
              <span style={{ color: "#999", fontSize: "12px" }}>Display Name</span>
              <p style={{ margin: "4px 0 0 0", fontWeight: "600" }}>
                {portalProfile?.full_name || player.full_name}
              </p>
            </div>
            <div>
              <span style={{ color: "#999", fontSize: "12px" }}>Account Role</span>
              <p style={{ margin: "4px 0 0 0", fontWeight: "600", color: "#e64a19" }}>
                {portalProfile?.role ? portalProfile.role.charAt(0).toUpperCase() + portalProfile.role.slice(1) : "Player"}
              </p>
            </div>
            <div>
              <span style={{ color: "#999", fontSize: "12px" }}>Registration Code</span>
              <code style={{
                display: "inline-block",
                marginTop: "4px",
                padding: "6px 10px",
                backgroundColor: "#ffffff",
                borderRadius: "4px",
                fontSize: "13px",
                fontWeight: "bold",
                letterSpacing: "1px",
                color: "#e64a19"
              }}>
                {player.registration_code}
              </code>
              <span style={{ marginLeft: "8px", color: "green", fontSize: "12px", fontWeight: "600" }}>
                ✓ Registered
              </span>
            </div>
            {portalProfile?.created_at && (
              <div>
                <span style={{ color: "#999", fontSize: "12px" }}>Account Created</span>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#666" }}>
                  {new Date(portalProfile.created_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>

        <div style={{ backgroundColor: "#f0f0f050", borderRadius: "8px", padding: "12px", marginBottom: "20px", fontSize: "12px", color: "#666", textAlign: "center", borderLeft: "3px solid #e64a19" }}>
          <p style={{ margin: "0" }}>
            ✓ <strong>Account Verified:</strong> Your player record and portal account are linked and synchronized.
          </p>
        </div>

        <Link href={session ? dashboardPath(session.profile.role) : "/login"} className={styles.submit} style={{ display: "block", textDecoration: "none", textAlign: "center" }}>
          Back to Dashboard
        </Link>
      </section>

      <Link href="/" className={styles.backHome}>Back to website</Link>
    </main>
  );
}
