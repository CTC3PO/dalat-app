import { Link } from "@/lib/i18n/routing";
import { getTranslations } from "next-intl/server";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "./user-menu";
import { NotificationInbox } from "./notification-inbox";
import { generateSubscriberHash } from "@/lib/novu";

export async function AuthButton() {
  const supabase = await createClient();
  const t = await getTranslations("nav");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Button asChild size="sm" variant="outline">
        <Link href="/auth/login">{t("signIn")}</Link>
      </Button>
    );
  }

  // Fetch profile for avatar and role
  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_url, display_name, username, role")
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
        role={profile?.role || "user"}
      />
    </div>
  );
}
