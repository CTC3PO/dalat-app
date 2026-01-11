export type Locale = 'en' | 'fr' | 'vi';
export type UserRole = 'user' | 'admin' | 'contributor';

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  locale: Locale;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Organizer {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  is_verified: boolean;
  priority_score: number;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  profiles?: Profile;
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
  previous_slugs: string[];
  tribe_id: string | null;
  organizer_id: string | null;
  title: string;
  description: string | null;
  image_url: string | null;
  location_name: string | null;
  address: string | null;
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
  organizers?: Organizer;
}

export interface Rsvp {
  id: string;
  event_id: string;
  user_id: string;
  status: "going" | "waitlist" | "cancelled" | "interested";
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
  interested_count: number;
}

// AI Extraction types
export interface ExtractedEventData {
  title: string;
  description: string | null;
  starts_at: string;  // ISO string
  ends_at: string | null;
  location_name: string | null;
  address: string | null;
  confidence: number;  // 0-1, how confident AI is about extraction
  // Deduplication results (filled in after checking)
  duplicate_of?: string;  // Event ID if duplicate found
  duplicate_confidence?: number;
}

export interface ExtractionLog {
  id: string;
  user_id: string;
  image_url: string;
  organizer_id: string | null;
  extracted_count: number;
  published_count: number;
  skipped_count: number;
  raw_response: ExtractedEventData[] | null;
  status: 'pending' | 'reviewed' | 'completed';
  created_at: string;
  // Joined data
  profiles?: Profile;
  organizers?: Organizer;
}
