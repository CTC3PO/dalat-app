import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { EventCard } from "@/components/events/event-card";
import { Button } from "@/components/ui/button";
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
  const counts: Record<string, EventCounts> = {};

  // Fetch counts for each event using the RPC function
  await Promise.all(
    eventIds.map(async (eventId) => {
      const { data } = await supabase.rpc("get_event_counts", {
        p_event_id: eventId,
      });
      if (data) {
        counts[eventId] = data as EventCounts;
      }
    })
  );

  return counts;
}

async function EventsFeed() {
  const events = await getEvents();
  const eventIds = events.map((e) => e.id);
  const counts = await getEventCounts(eventIds);

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="mb-4">No upcoming events yet.</p>
        <Link href="/events/new">
          <Button>Create the first event</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <EventCard key={event.id} event={event} counts={counts[event.id]} />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-4xl items-center justify-between mx-auto px-4">
          <Link href="/" className="font-bold text-lg">
            dalat.app
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/events/new">
              <Button size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-1" />
                Event
              </Button>
            </Link>
            <Suspense>
              <AuthButton />
            </Suspense>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 container max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Upcoming Events</h1>
          <p className="text-muted-foreground">
            Discover what&apos;s happening in Da Lat
          </p>
        </div>

        <Suspense
          fallback={
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-48 bg-muted animate-pulse rounded-lg"
                />
              ))}
            </div>
          }
        >
          <EventsFeed />
        </Suspense>
      </div>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container max-w-4xl mx-auto px-4 flex items-center justify-between text-sm text-muted-foreground">
          <p>Events without the noise</p>
          <ThemeSwitcher />
        </div>
      </footer>
    </main>
  );
}
