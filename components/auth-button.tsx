import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "./user-menu";
import { NotificationInbox } from "./notification-inbox";
import { generateSubscriberHash } from "@/lib/novu";
import type { Locale } from "@/lib/types";

export async function AuthButton() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Button asChild size="sm" variant="outline">
        <Link href="/auth/login">Sign in</Link>
      </Button>
    );
  }

  // Fetch profile for avatar and locale
  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_url, display_name, username, locale")
    .eq("id", user.id)
    .single();

  // Generate HMAC hash for secure Novu authentication
  const subscriberHash = generateSubscriberHash(user.id);

  return (
    <div className="flex items-center gap-2">
      <NotificationInbox subscriberId={user.id} subscriberHash={subscriberHash} />
      <UserMenu
        avatarUrl={profile?.avatar_url || null}
        displayName={profile?.display_name || null}
        username={profile?.username || null}
        userId={user.id}
        currentLocale={(profile?.locale as Locale) || 'en'}
      />
    </div>
  );
}
