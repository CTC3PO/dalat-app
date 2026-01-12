import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ slug: string }>;
}

/**
 * POST /api/series/[slug]/rsvp - Subscribe to series (RSVP all future)
 */
export async function POST(request: Request, { params }: Params) {
  const { slug } = await params;
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get series
  const { data: series, error: fetchError } = await supabase
    .from("event_series")
    .select("id, status")
    .eq("slug", slug)
    .single();

  if (fetchError || !series) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  if (series.status !== "active") {
    return NextResponse.json({ error: "Series is not active" }, { status: 400 });
  }

  // Subscribe using the RPC function (handles both series_rsvps and event RSVPs)
  const { error: subscribeError } = await supabase.rpc("subscribe_to_series", {
    p_series_id: series.id,
    p_user_id: user.id,
  });

  if (subscribeError) {
    console.error("Subscribe error:", subscribeError);
    return NextResponse.json(
      { error: "Failed to subscribe: " + subscribeError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, subscribed: true });
}

/**
 * DELETE /api/series/[slug]/rsvp - Unsubscribe from series
 */
export async function DELETE(request: Request, { params }: Params) {
  const { slug } = await params;
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get series
  const { data: series, error: fetchError } = await supabase
    .from("event_series")
    .select("id")
    .eq("slug", slug)
    .single();

  if (fetchError || !series) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  // Unsubscribe using the RPC function
  const { error: unsubscribeError } = await supabase.rpc("unsubscribe_from_series", {
    p_series_id: series.id,
    p_user_id: user.id,
  });

  if (unsubscribeError) {
    console.error("Unsubscribe error:", unsubscribeError);
    return NextResponse.json(
      { error: "Failed to unsubscribe: " + unsubscribeError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, subscribed: false });
}

/**
 * GET /api/series/[slug]/rsvp - Check subscription status
 */
export async function GET(request: Request, { params }: Params) {
  const { slug } = await params;
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ subscribed: false });
  }

  // Get series
  const { data: series, error: fetchError } = await supabase
    .from("event_series")
    .select("id")
    .eq("slug", slug)
    .single();

  if (fetchError || !series) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  // Check subscription
  const { data: subscribed } = await supabase.rpc("is_subscribed_to_series", {
    p_series_id: series.id,
    p_user_id: user.id,
  });

  return NextResponse.json({ subscribed: subscribed ?? false });
}
