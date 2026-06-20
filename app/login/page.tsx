"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  dashboardPath,
  getStoredPortalSession,
  signInToPortal,
} from "@/lib/portal-auth";
import styles from "./login.module.css";

type PortalMessage = {
  text: string;
  tone: "success" | "error";
};

export default function LoginPage() {
  const [message, setMessage] = useState<PortalMessage | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const session = getStoredPortalSession();
    if (session) window.location.href = dashboardPath(session.profile.role);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    setMessage(null);
    setIsSubmitting(true);

    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");

    try {
      const session = await signInToPortal(email, password);
      window.location.href = dashboardPath(session.profile.role);
    } catch (error) {
      setMessage({
        tone: "error",
        text: getPortalErrorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <Link href="/" className={styles.logo} aria-label="Magic Initiative Rwanda home">
        <span className={styles.ball}>BB</span>
        <span className={styles.title}>Magic Initiative Rwanda</span>
      </Link>

      <section className={styles.card} aria-label="Magic Initiative Rwanda portal login">
        <h1 className={styles.heading}>Magic Initiative Rwanda Portal</h1>
        <p className={styles.subheading}>
          Sign in once and your role sends you to the correct dashboard.
        </p>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="email">Email Address</label>
            <input id="email" name="email" type="email" required placeholder="name@domain.com" />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              placeholder="Enter your password"
            />
          </div>

          <div className={styles.options}>
            <label className={styles.checkbox}>
              <input type="checkbox" />
              Remember me
            </label>
            <a href="#forgot">Forgot Password?</a>
          </div>

          {message && (
            <p className={`${styles.message} ${styles[message.tone]}`} role="status" aria-live="polite">
              {message.text}
            </p>
          )}

          <button type="submit" className={styles.submit} disabled={isSubmitting}>
            {isSubmitting ? "Please wait..." : "Access Account"}
          </button>

          <div style={{ marginTop: "20px", textAlign: "center", paddingTop: "20px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <p style={{ fontSize: "12px", color: "#a0aab2", marginBottom: "12px" }}>
              Have a registration code from your coach?
            </p>
            <Link href="/player-register" style={{ color: "#e64a19", textDecoration: "none", fontWeight: "600", fontSize: "13px" }}>
              Register as Player with Code →
            </Link>
          </div>
        </form>
      </section>

      <Link href="/" className={styles.backHome}>Back to website</Link>
    </main>
  );
}

function getPortalErrorMessage(error: unknown) {
  const fallback = "Unable to access the portal. Please check your details and try again.";
  if (!(error instanceof Error)) return fallback;

  const message = error.message.toLowerCase();

  if (message.includes("already registered") || message.includes("already exists")) {
    return "An account with this email already exists. Please sign in instead.";
  }

  if (message.includes("invalid login") || message.includes("invalid credentials")) {
    return "The email or password is incorrect. Please try again.";
  }

  if (message.includes("email not confirmed")) {
    return "Please confirm your email address before signing in.";
  }

  return error.message || fallback;
}
