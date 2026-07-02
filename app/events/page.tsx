import { PublicPageShell } from "@/app/components/public-shell";
import { EventList } from "@/app/events/event-list";
import { getAllEvents } from "@/lib/magic-data";

export default async function EventsPage() {
  const events = await getAllEvents();

  return (
    <PublicPageShell
      eyebrow="Events"
      title="Upcoming club events"
      description="Browse fixtures, community days, meetings, and published calendar items."
    >
      {events.length > 0 ? <EventList events={events} /> : <p className="public-empty">No events have been published yet.</p>}
    </PublicPageShell>
  );
}
