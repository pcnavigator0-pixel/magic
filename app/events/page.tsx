import { PublicPageShell } from "@/app/components/public-shell";
import { EventCountdown } from "@/app/components/event-countdown";
import { formatDisplayDate, getMagicData } from "@/lib/magic-data";

export default async function EventsPage() {
  const data = await getMagicData();

  return (
    <PublicPageShell
      eyebrow="Events"
      title="Upcoming club events"
      description="Browse fixtures, community days, meetings, and published calendar items."
    >
      <section className="public-list">
        {data.events.map((event) => (
          <article className="public-row" key={event.id}>
            <div className="public-date">
              <strong><EventCountdown eventDate={event.event_date} eventTime={event.event_time} compact /></strong>
              <span>countdown</span>
            </div>
            <div>
              <span>{event.category}</span>
              <h2>{event.title}</h2>
              <p>{formatDisplayDate(event.event_date)}{event.event_time ? ` at ${event.event_time}` : ""} - {event.venue}</p>
              {event.description && <p>{event.description}</p>}
            </div>
          </article>
        ))}
      </section>
      {data.events.length === 0 && <p className="public-empty">No events have been published yet.</p>}
    </PublicPageShell>
  );
}
