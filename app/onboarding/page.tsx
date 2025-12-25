import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/profile/profile-form";

export default async function OnboardingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Check if user already has a username
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (profile?.username) {
    redirect("/");
  }

  // Get display name from OAuth metadata if available
  const defaultDisplayName =
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    "";

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Welcome to dalat.app</h1>
          <p className="text-muted-foreground">
            Let&apos;s set up your profile
          </p>
        </div>
        <ProfileForm userId={user.id} defaultDisplayName={defaultDisplayName} />
      </div>
    </main>
  );
}
