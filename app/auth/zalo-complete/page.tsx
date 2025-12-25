"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ZaloComplete() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");

    if (accessToken) {
      completeAuth(accessToken);
    } else {
      setError("No access token received");
    }
  }, []);

  async function completeAuth(token: string) {
    try {
      // Fetch user info from Zalo (client-side = user's IP = bypasses geo-restriction)
      const res = await fetch(
        "https://graph.zalo.me/v2.0/me?fields=id,name,picture",
        {
          headers: { access_token: token },
        }
      );

      if (!res.ok) {
        throw new Error("Failed to fetch Zalo user info");
      }

      const zaloUser = await res.json();

      if (zaloUser.error) {
        throw new Error(zaloUser.message || "Zalo API error");
      }

      // Sign in or create Supabase user
      const supabase = createClient();
      const email = `zalo_${zaloUser.id}@dalat.app`;

      // Try sign in first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: zaloUser.id,
      });

      if (signInError) {
        // User doesn't exist, sign up
        if (
          signInError.message.includes("Invalid login") ||
          signInError.message.includes("Invalid email")
        ) {
          const { error: signUpError } = await supabase.auth.signUp({
            email,
            password: zaloUser.id,
            options: {
              data: {
                zalo_id: zaloUser.id,
                display_name: zaloUser.name,
                avatar_url: zaloUser.picture?.data?.url,
              },
            },
          });

          if (signUpError) {
            throw signUpError;
          }

          // Update profile with Zalo info
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) {
            await supabase.from("profiles").update({
              display_name: zaloUser.name,
              avatar_url: zaloUser.picture?.data?.url,
            }).eq("id", user.id);
          }

          // New user - go to onboarding
          router.push("/onboarding");
          return;
        }
        throw signInError;
      }

      // Existing user - check if needs onboarding
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .single();

        if (!profile?.username) {
          router.push("/onboarding");
          return;
        }
      }

      router.push("/");
    } catch (err) {
      console.error("Zalo auth error:", err);
      setError(err instanceof Error ? err.message : "Authentication failed");
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <a href="/auth/login" className="text-primary hover:underline">
            Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-muted-foreground">Completing login...</p>
      </div>
    </div>
  );
}
