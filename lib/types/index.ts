export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tribe {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  slug: string;
  tribe_id: string | null;
  title: string;
  description: string | null;
  image_url: string | null;
  location_name: string | null;
  google_maps_url: string | null;
  external_chat_url: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  capacity: number | null;
  status: "draft" | "published" | "cancelled";
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined data
  profiles?: Profile;
  tribes?: Tribe;
}

export interface Rsvp {
  id: string;
  event_id: string;
  user_id: string;
  status: "going" | "waitlist" | "cancelled";
  plus_ones: number;
  created_at: string;
  // Joined data
  profiles?: Profile;
}

export interface EventCounts {
  event_id: string;
  going_count: number;
  going_spots: number;
  waitlist_count: number;
}
