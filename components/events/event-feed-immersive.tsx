import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { EventCardImmersive } from "./event-card-immersive";
import { EventFeedTabs, type EventLifecycle } from "./event-feed-tabs";
import type { Event, EventCounts } from "@/lib/types";

interface EventFeedImmersiveProps {
  lifecycle?: EventLifecycle;
}

async function getEventsByLifecycle(lifecycle: EventLifecycle) {
  const supabase = await createClient();

  const { data: events, error } = await supabase.rpc("get_events_by_lifecycle", {
    p_lifecycle: lifecycle,
    p_limit: 20,
  });

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

function FloatingTabs({ activeTab }: { activeTab: EventLifecycle }) {
  return (
    <Suspense fallback={null}>
      <EventFeedTabs activeTab={activeTab} variant="floating" useUrlNavigation />
    </Suspense>
  );
}

export async function EventFeedImmersive({ lifecycle = "upcoming" }: EventFeedImmersiveProps) {
  const events = await getEventsByLifecycle(lifecycle);
  const eventIds = events.map((e) => e.id);
  const counts = await getEventCounts(eventIds);
  const t = await getTranslations("home");

  if (events.length === 0) {
    const emptyMessage =
      lifecycle === "happening"
        ? t("noHappening")
        : lifecycle === "past"
          ? t("noPast")
          : t("noUpcoming");

    return (
      <div className="h-[100dvh] flex flex-col bg-black text-white">
        {/* Floating tabs */}
        <div className="absolute top-14 left-0 right-0 z-40 px-3">
          <FloatingTabs activeTab={lifecycle} />
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-8">
            <p className="text-lg mb-2">{emptyMessage}</p>
            {lifecycle === "upcoming" && (
              <p className="text-white/60 text-sm">
                Be the first to create an event in Da Lat!
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] relative">
      {/* Floating tabs below the header */}
      <div className="absolute top-14 left-0 right-0 z-40 px-3">
        <FloatingTabs activeTab={lifecycle} />
      </div>

      {/* Scrollable event cards */}
      <div className="h-[100dvh] overflow-y-auto snap-y snap-mandatory overscroll-contain scrollbar-hide">
        {events.map((event) => (
          <EventCardImmersive
            key={event.id}
            event={event}
            counts={counts[event.id]}
          />
        ))}
      </div>
    </div>
  );
}
