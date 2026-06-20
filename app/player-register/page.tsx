"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  dashboardPath,
  getStoredPortalSession,
  registerPlayerWithCode,
} from "@/lib/portal-auth";
import { checkRegistrationCode } from "@/lib/magic-data";
import styles from "../login/login.module.css";

type PlayerRegisterMessage = {
  text: string;
  tone: "success" | "error" | "info";
};

type PlayerInfo = {
  position: string;
  jersey_number: number;
};

export default function PlayerRegisterPage() {
  const [step, setStep] = useState<"code" | "details" | "success">("code");
  const [codeInput, setCodeInput] = useState("");
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const [message, setMessage] = useState<PlayerRegisterMessage | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredCode, setRegisteredCode] = useState("");

  useEffect(() => {
    const session = getStoredPortalSession();
    if (session) window.location.href = dashboardPath(session.profile.role);
  }, []);

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    const code = codeInput.trim();

    try {
      if (!code || code.length < 1) {
        throw new Error("Please enter your registration code.");
      }

      const result = await checkRegistrationCode(code);

      if (result.status === "not_found") {
        throw new Error(`Code "${code}" not found. Please check and try again.`);
      }

      if (result.status === "already_used") {
        throw new Error("This registration code has already been used. Contact your coach for a new code.");
      }

      setPlayerInfo({
        position: result.player.position,
        jersey_number: result.player.jersey_number,
      });
      setRegisteredCode(code);
      setStep("details");
      setMessage({
        tone: "info",
        text: `✓ Code verified! You're assigned as ${result.player.position} #${result.player.jersey_number}.`,
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Failed to verify code.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRegisterAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    const form = event.currentTarget;
    const data = new FormData(form);
    const fullName = String(data.get("fullName") || "").trim();
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    const confirmPassword = String(data.get("confirmPassword") || "");

    try {
      if (!fullName || !email || !password) {
        throw new Error("Please fill in all fields.");
      }

      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }

      if (password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      if (!registeredCode || registeredCode.length < 1) {
        throw new Error("Registration code is invalid or expired. Please go back and verify again.");
      }

      await registerPlayerWithCode({
        registrationCode: registeredCode,
        fullName,
        email,
        password,
      });

      setStep("success");
      form.reset();
      setMessage(null);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Registration failed. Please try again.";
      
      setMessage({
        tone: "error",
        text: errorMsg,
      });
      
      // If registration failed, offer to go back
      if (errorMsg.includes("Invalid registration code") || errorMsg.includes("Code") || errorMsg.includes("already been used")) {
        console.error("[Registration Error]", errorMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <Link href="/" className={styles.logo} aria-label="Magic Initiative Rwanda home">
        <span className={styles.ball}>🏀</span>
        <span className={styles.title}>Magic Initiative Rwanda</span>
      </Link>

      <section className={styles.card} aria-label="Magic Initiative Rwanda player registration">
        {step === "code" && (
          <>
            <h1 className={styles.heading}>Player Registration</h1>
            <p className={styles.subheading}>
              Your coach assigned you a registration code. Enter it below to claim your account and complete your profile.
            </p>

            <form onSubmit={handleVerifyCode}>
              <div className={styles.formGroup}>
                <label htmlFor="registrationCode">Registration Code</label>
                <input
                  id="registrationCode"
                  type="text"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  placeholder="e.g., ab12cd34 (any case)"
                  maxLength={8}
                  required
                  style={{ fontFamily: "monospace", fontSize: "16px", letterSpacing: "2px" }}
                />
              </div>

              <p style={{ fontSize: "12px", color: "#a0aab2", marginBottom: "20px" }}>
                Your coach will provide this code via email or message.
              </p>

              {message && (
                <p className={`${styles.message} ${styles[message.tone]}`} role="status" aria-live="polite">
                  {message.text}
                </p>
              )}

              <button type="submit" className={styles.submit} disabled={isSubmitting}>
                {isSubmitting ? "Verifying..." : "Verify Code & Continue"}
              </button>
            </form>

            <Link href="/login" className={styles.backHome} style={{ marginTop: "20px" }}>
              Back to Login
            </Link>
          </>
        )}

        {step === "details" && playerInfo && (
          <>
            <h1 className={styles.heading}>Complete Your Profile</h1>
            <p className={styles.subheading}>
              You're assigned as <strong>{playerInfo.position} #{playerInfo.jersey_number}</strong>. 
              Now enter your real name and create a secure password.
            </p>

            <form onSubmit={handleRegisterAccount}>
              <div className={styles.formGroup}>
                <label htmlFor="fullName">Your Full Name</label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required
                  placeholder="Enter your real full name"
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="your.email@domain.com"
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={6}
                  placeholder="Re-enter your password"
                />
              </div>

              {message && (
                <p className={`${styles.message} ${styles[message.tone]}`} role="status" aria-live="polite">
                  {message.text}
                </p>
              )}

              <button type="submit" className={styles.submit} disabled={isSubmitting}>
                {isSubmitting ? "Creating Account..." : "Create My Account"}
              </button>

              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setStep("code");
                  setMessage(null);
                  setPlayerInfo(null);
                }}
                disabled={isSubmitting}
                style={{ marginTop: "10px", width: "100%" }}
              >
                Back
              </button>
            </form>
          </>
        )}

        {step === "success" && (
          <>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "20px" }}>✓</div>
              <h1 className={styles.heading}>Registration Successful!</h1>
              <p className={styles.subheading} style={{ marginBottom: "30px" }}>
                Your account has been created and linked to your player profile. 
                Your data is now stored in both our databases.
              </p>

              <Link href="/login" className={styles.submit} style={{ display: "inline-block", textDecoration: "none", marginBottom: "12px" }}>
                Sign In to Dashboard
              </Link>

              <p style={{ fontSize: "12px", color: "#a0aab2", margin: "16px 0 0 0" }}>
                After signing in, visit <Link href="/player-profile" style={{ color: "#e64a19", textDecoration: "none", fontWeight: "600" }}>your profile page</Link> to view your complete account details from both tables.
              </p>
            </div>
          </>
        )}
      </section>

      <Link href="/" className={styles.backHome}>Back to website</Link>
    </main>
  );
}
