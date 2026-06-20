"use client";

import { useEffect, useMemo, useState } from "react";

type EventCountdownProps = {
  eventDate: string;
  eventTime?: string | null;
  eventTimeZone?: string;
  compact?: boolean;
};

type ServerTimeResponse = {
  serverTimeMs?: number;
};

let serverClockPromise: Promise<number | null> | null = null;
let lastServerSyncMs = 0;
const defaultEventTimeZone = "Africa/Kigali";
const SERVER_SYNC_INTERVAL = 5 * 60_000; // Only sync every 5 minutes to avoid hammering the API

export function EventCountdown({
  eventDate,
  eventTime,
  eventTimeZone = defaultEventTimeZone,
  compact = false,
}: EventCountdownProps) {
  const eventTimestamp = useMemo(
    () => getEventTimestamp(eventDate, eventTime, eventTimeZone),
    [eventDate, eventTime, eventTimeZone],
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let ignore = false;
    let clockBaseMs = Date.now();
    let clockBasePerformanceMs = window.performance.now();

    const syncClock = async () => {
      // Only attempt sync if enough time has passed since last attempt
      const now = Date.now();
      if (now - lastServerSyncMs < SERVER_SYNC_INTERVAL) {
        return;
      }

      const serverTimeMs = await getServerTime();
      if (ignore || !serverTimeMs) return;

      lastServerSyncMs = Date.now();
      clockBaseMs = serverTimeMs;
      clockBasePerformanceMs = window.performance.now();
      setNow(clockBaseMs);
    };

    const tick = () => {
      setNow(clockBaseMs + (window.performance.now() - clockBasePerformanceMs));
    };

    syncClock();
    const timer = window.setInterval(tick, 1000);
    const syncTimer = window.setInterval(syncClock, 30_000); // Check every 30s but only sync if interval elapsed

    return () => {
      ignore = true;
      window.clearInterval(timer);
      window.clearInterval(syncTimer);
    };
  }, []);

  const remainingMs = eventTimestamp - now;
  const isDone = remainingMs <= 0;

  if (isDone) {
    return <span className="event-countdown event-countdown-done">Event is done</span>;
  }

  const remaining = formatRemaining(remainingMs, compact);
  const isAlmostDue = remainingMs <= 24 * 60 * 60 * 1000;
  const timeZoneLabel = formatTimeZoneLabel(eventTimestamp, eventTimeZone);
  const text = isAlmostDue ? `Due date is almost reached: ${remaining}` : remaining;

  return (
    <span
      className={`event-countdown ${isAlmostDue ? "event-countdown-soon" : ""}`}
      title={`Event time zone: ${eventTimeZone}`}
    >
      {compact ? text : `${text} · ${timeZoneLabel}`}
    </span>
  );
}

function getEventTimestamp(eventDate: string, eventTime: string | null | undefined, timeZone: string) {
  const time = eventTime || "00:00";
  const [year, month, day] = eventDate.split("-").map(Number);
  const [hour = 0, minute = 0, second = 0] = time.split(":").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = getTimeZoneOffset(utcGuess, timeZone);

  return utcGuess - offset;
}

function formatRemaining(value: number, compact: boolean) {
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (compact) {
    if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes}m ${seconds}s`;
  }

  if (days > 0) return `${days} days ${hours} hours ${minutes} min ${seconds}s`;
  if (hours > 0) return `${hours} hours ${minutes} min ${seconds}s`;
  return `${minutes} min ${seconds}s`;
}

async function getServerTime() {
  // Return null if we already tried and the API isn't available
  // This prevents hammering a failing endpoint
  if (serverClockPromise instanceof Error) {
    return null;
  }

  if (serverClockPromise instanceof Promise) {
    return serverClockPromise;
  }

  serverClockPromise = fetch("/api/server-time", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) {
        // Mark this promise as failed so we don't retry immediately
        serverClockPromise = new Error("API not available") as any;
        return null;
      }

      const data = (await response.json()) as ServerTimeResponse;
      return typeof data.serverTimeMs === "number" ? data.serverTimeMs : null;
    })
    .catch(() => {
      // Mark failure to prevent rapid retries
      serverClockPromise = new Error("API fetch failed") as any;
      return null;
    });

  return serverClockPromise;
}

function getTimeZoneOffset(timestamp: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const timeZoneTimestamp = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return timeZoneTimestamp - timestamp;
}

function formatTimeZoneLabel(timestamp: number, timeZone: string) {
  const name =
    new Intl.DateTimeFormat("en", {
      timeZone,
      timeZoneName: "short",
    })
      .formatToParts(new Date(timestamp))
      .find((part) => part.type === "timeZoneName")?.value || timeZone;
  const city = timeZone.split("/").pop()?.replace(/_/g, " ") || timeZone;

  return `${city} time (${name})`;
}
