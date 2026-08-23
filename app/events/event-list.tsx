"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EventCountdown } from "@/app/components/event-countdown";
import type { EventItem } from "@/lib/magic-data";

type EventListProps = {
  events: EventItem[];
};

const batchSize = 12;
const defaultStatus = "all";
const defaultCategory = "all";

export function EventList({ events }: EventListProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(defaultCategory);
  const [status, setStatus] = useState(defaultStatus);
  const [visibleCount, setVisibleCount] = useState(batchSize);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const sortedEvents = useMemo(
    () =>
      [...events].sort((a, b) => {
        const dateCompare = getEventTime(b) - getEventTime(a);
        if (dateCompare !== 0) return dateCompare;
        return b.title.localeCompare(a.title);
      }),
    [events],
  );

  const categories = useMemo(
    () => Array.from(new Set(sortedEvents.map((event) => event.category).filter(Boolean))).sort(),
    [sortedEvents],
  );

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const now = Date.now();

    return sortedEvents.filter((event) => {
      const haystack = [
        event.title,
        event.category,
        event.venue,
        event.description || "",
        formatDisplayDate(event.event_date),
      ]
        .join(" ")
        .toLowerCase();
      const matchesQuery = normalizedQuery ? haystack.includes(normalizedQuery) : true;
      const matchesCategory = category === defaultCategory || event.category === category;
      const eventTime = getEventTime(event);
      const matchesStatus =
        status === defaultStatus ||
        (status === "upcoming" && eventTime >= now) ||
        (status === "past" && eventTime < now);

      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [category, query, sortedEvents, status]);

  const visibleEvents = filteredEvents.slice(0, visibleCount);
  const hasMore = visibleCount < filteredEvents.length;

  useEffect(() => {
    setVisibleCount(batchSize);
  }, [category, query, status]);

  useEffect(() => {
    if (!hasMore) return;

    const marker = loadMoreRef.current;
    if (!marker) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount((current) => Math.min(current + batchSize, filteredEvents.length));
        }
      },
      { rootMargin: "360px 0px" },
    );

    observer.observe(marker);
    return () => observer.disconnect();
  }, [filteredEvents.length, hasMore]);

  return (
    <>
      <section className="event-filter-panel" aria-label="Event filters">
        <label>
          <span>Search events</span>
          <input
            type="search"
            placeholder="Search by title, venue, category..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <label>
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value={defaultCategory}>All categories</option>
            {categories.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>When</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value={defaultStatus}>All events</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past events</option>
          </select>
        </label>

        <p>
          Showing {visibleEvents.length} of {filteredEvents.length} events
        </p>
      </section>

      <section className="public-list event-list">
        {visibleEvents.map((event) => {
          const dateParts = getDateParts(event.event_date);

          return (
            <article className="public-row event-card" id={`event-${event.id}`} key={event.id}>
              <div className="public-date event-date-tile">
                <strong>{dateParts.day}</strong>
                <span>{dateParts.month} {dateParts.year}</span>
                <small><EventCountdown eventDate={event.event_date} eventTime={event.event_time} compact /></small>
              </div>
              <div className="event-card-content">
                <span>{event.category}</span>
                <h2>{event.title}</h2>
                <p className="event-card-meta">
                  <span><i className="fa-regular fa-calendar" aria-hidden="true" /> {formatDisplayDate(event.event_date)}{event.event_time ? ` · ${event.event_time}` : ""}</span>
                  <span><i className="fa-solid fa-location-dot" aria-hidden="true" /> {event.venue}</span>
                </p>
                {event.description && <p className="event-card-description">{event.description}</p>}
                <a className="event-card-link" href={`#event-${event.id}`}>
                  View details <i className="fa-solid fa-arrow-right" aria-hidden="true" />
                </a>
              </div>
            </article>
          );
        })}
      </section>

      {filteredEvents.length === 0 && <p className="public-empty">No events match those filters.</p>}

      {hasMore && (
        <div className="event-list-loader" ref={loadMoreRef}>
          <button type="button" onClick={() => setVisibleCount((current) => Math.min(current + batchSize, filteredEvents.length))}>
            Load more events
          </button>
        </div>
      )}
    </>
  );
}

function getEventTime(event: EventItem) {
  return new Date(`${event.event_date}T${event.event_time || "00:00"}`).getTime();
}

function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getDateParts(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return {
    day: new Intl.DateTimeFormat("en", { day: "2-digit" }).format(date),
    month: new Intl.DateTimeFormat("en", { month: "short" }).format(date).toUpperCase(),
    year: new Intl.DateTimeFormat("en", { year: "numeric" }).format(date),
  };
}
