import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { scheduleEventReminders } from '@/lib/novu';
import type { Locale } from '@/lib/types';

// Schedules reminders for interested users (no immediate confirmation email)
export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { eventId } = await request.json();

  if (!eventId) {
    return NextResponse.json({ error: 'eventId required' }, { status: 400 });
  }

  const [{ data: profile }, { data: event }] = await Promise.all([
    supabase
      .from('profiles')
      .select('locale')
      .eq('id', user.id)
      .single(),
    supabase
      .from('events')
      .select('title, slug, starts_at, location_name, google_maps_url')
      .eq('id', eventId)
      .single(),
  ]);

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const locale = (profile?.locale as Locale) || 'en';

  try {
    // Schedule 24h and 2h reminders (same as going users)
    // No immediate confirmation - lighter touch for "interested"
    const scheduled = await scheduleEventReminders(
      user.id,
      locale,
      eventId,
      event.title,
      event.slug,
      event.starts_at,
      event.location_name,
      event.google_maps_url
    );

    return NextResponse.json({ success: true, scheduled });
  } catch (error) {
    console.error('Interested notification error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
