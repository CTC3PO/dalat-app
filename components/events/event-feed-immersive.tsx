import { createClient } from "@/lib/supabase/server";
import { EventCardImmersive } from "./event-card-immersive";
import type { Event, EventCounts } from "@/lib/types";

async function getEvents() {
  const supabase = await createClient();

  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .eq("status", "published")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(20);

  if (error) {
    console.error("Error fetching events:", error);
    return [];
  }

  return events as Event[];
}

async function getEventCounts(eventIds: string[]) {
  if (eventIds.length === 0) return {};

  const supabase = await createClient();

  const { data: rsvps } = await supabase
    .from("rsvps")
    .select("event_id, status, plus_ones")
    .in("event_id", eventIds);

  const counts: Record<string, EventCounts> = {};

  for (const eventId of eventIds) {
    const eventRsvps = rsvps?.filter((r) => r.event_id === eventId) || [];
    const goingRsvps = eventRsvps.filter((r) => r.status === "going");
    const waitlistRsvps = eventRsvps.filter((r) => r.status === "waitlist");
    const interestedRsvps = eventRsvps.filter((r) => r.status === "interested");

    counts[eventId] = {
      event_id: eventId,
      going_count: goingRsvps.length,
      waitlist_count: waitlistRsvps.length,
      going_spots: goingRsvps.reduce(
        (sum, r) => sum + 1 + (r.plus_ones || 0),
        0
      ),
      interested_count: interestedRsvps.length,
    };
  }

  return counts;
}

export async function EventFeedImmersive() {
  const events = await getEvents();
  const eventIds = events.map((e) => e.id);
  const counts = await getEventCounts(eventIds);

  if (events.length === 0) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-black text-white">
        <div className="text-center px-8">
          <p className="text-lg mb-2">No upcoming events yet</p>
          <p className="text-white/60 text-sm">
            Be the first to create an event in Da Lat!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] overflow-y-auto snap-y snap-mandatory overscroll-contain scrollbar-hide">
      {events.map((event) => (
        <EventCardImmersive
          key={event.id}
          event={event}
          counts={counts[event.id]}
        />
      ))}
    </div>
  );
}
