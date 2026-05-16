"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import styles from "./login.module.css";

type PortalRole = "fan" | "coach";

export default function LoginPage() {
  const [role, setRole] = useState<PortalRole>("fan");

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (role === "coach") {
      window.location.href = "/coach-dashboard";
      return;
    }

    window.alert("Fan logged in successfully.");
  }

  return (
    <main className={styles.page}>
      <Link href="/" className={styles.logo} aria-label="MAGIC BBC home">
        <span className={styles.ball}>🏀</span>
        <span className={styles.title}>MAGIC BBC</span>
      </Link>

      <section className={styles.card} aria-label="MAGIC BBC portal login">
        <div className={styles.toggle} role="tablist" aria-label="Portal type">
          <button
            type="button"
            className={`${styles.toggleButton} ${role === "fan" ? styles.active : ""}`}
            onClick={() => setRole("fan")}
            aria-pressed={role === "fan"}
          >
            Fan Login
          </button>
          <button
            type="button"
            className={`${styles.toggleButton} ${role === "coach" ? styles.active : ""}`}
            onClick={() => setRole("coach")}
            aria-pressed={role === "coach"}
          >
            Staff Portal
          </button>
        </div>

        <h1 className={styles.heading}>
          {role === "coach" ? "Coach & Staff Control Room" : "Welcome Back Fan"}
        </h1>

        <form onSubmit={handleLogin}>
          <div className={styles.formGroup}>
            <label htmlFor="username">Email Address / ID</label>
            <input id="username" type="email" required placeholder="name@domain.com" />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password">Password</label>
            <input id="password" type="password" required placeholder="••••••••" />
          </div>

          <div className={styles.options}>
            <label className={styles.checkbox}>
              <input type="checkbox" />
              Remember me
            </label>
            <a href="#forgot">Forgot Password?</a>
          </div>

          <button type="submit" className={styles.submit}>Access Account</button>
        </form>
      </section>

      <Link href="/" className={styles.backHome}>← Back to website</Link>
    </main>
  );
}
