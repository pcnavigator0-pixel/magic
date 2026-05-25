"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  dashboardPath,
  getStoredPortalSession,
  registerPortalAccount,
  signInToPortal,
  type PortalRole,
} from "@/lib/portal-auth";
import styles from "./login.module.css";

type PortalMode = "login" | "register";
type PortalMessage = {
  text: string;
  tone: "success" | "error";
};

export default function LoginPage() {
  const [mode, setMode] = useState<PortalMode>("login");
  const [role, setRole] = useState<PortalRole>("player");
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
    const fullName = String(data.get("fullName") || "").trim();

    try {
      if (mode === "register") {
        await registerPortalAccount({ email, password, fullName, role });
        form.reset();
        setRole("player");
        setMode("login");
        setMessage({
          tone: "success",
          text: "Account created successfully. Please sign in below with your email and password.",
        });

        return;
      }

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
      <Link href="/" className={styles.logo} aria-label="MAGIC BBC home">
        <span className={styles.ball}>BB</span>
        <span className={styles.title}>MAGIC BBC</span>
      </Link>

      <section className={styles.card} aria-label="MAGIC BBC portal login">
        <div className={styles.toggle} role="tablist" aria-label="Portal action">
          <button
            type="button"
            className={`${styles.toggleButton} ${mode === "login" ? styles.active : ""}`}
            onClick={() => {
              setMode("login");
              setMessage(null);
            }}
            aria-pressed={mode === "login"}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`${styles.toggleButton} ${mode === "register" ? styles.active : ""}`}
            onClick={() => {
              setMode("register");
              setMessage(null);
            }}
            aria-pressed={mode === "register"}
          >
            Register
          </button>
        </div>

        <h1 className={styles.heading}>
          {mode === "register" ? "Create Portal Account" : "MAGIC BBC Portal"}
        </h1>
        <p className={styles.subheading}>
          {mode === "register"
            ? "Register as a player or coach. Supabase Auth stores your password securely."
            : "Sign in once and your role sends you to the correct dashboard."}
        </p>

        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <>
              <div className={styles.roleGrid} aria-label="Account role">
                <button
                  type="button"
                  className={`${styles.roleButton} ${role === "player" ? styles.selectedRole : ""}`}
                  onClick={() => setRole("player")}
                >
                  Player
                </button>
                <button
                  type="button"
                  className={`${styles.roleButton} ${role === "coach" ? styles.selectedRole : ""}`}
                  onClick={() => setRole("coach")}
                >
                  Coach
                </button>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="fullName">Full Name</label>
                <input id="fullName" name="fullName" type="text" required placeholder="Your full name" />
              </div>
            </>
          )}

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

          {mode === "login" && (
            <div className={styles.options}>
              <label className={styles.checkbox}>
                <input type="checkbox" />
                Remember me
              </label>
              <a href="#forgot">Forgot Password?</a>
            </div>
          )}

          {message && (
            <p className={`${styles.message} ${styles[message.tone]}`} role="status" aria-live="polite">
              {message.text}
            </p>
          )}

          <button type="submit" className={styles.submit} disabled={isSubmitting}>
            {isSubmitting ? "Please wait..." : mode === "register" ? "Create Account" : "Access Account"}
          </button>
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
