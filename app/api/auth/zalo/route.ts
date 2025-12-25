import { NextResponse } from "next/server";
import { generateCodeVerifier, generateCodeChallenge } from "@/lib/auth/zalo";

export async function GET(request: Request) {
  try {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = crypto.randomUUID();

    const appId = process.env.NEXT_PUBLIC_ZALO_APP_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    console.log("[Zalo] Starting OAuth flow");
    console.log("[Zalo] App ID:", appId);
    console.log("[Zalo] App URL:", appUrl);

    if (!appId) {
      console.log("[Zalo] Error: No app ID configured");
      return NextResponse.redirect(
        new URL("/auth/error?error=Zalo not configured", appUrl)
      );
    }

    const redirectUri = `${appUrl}/api/auth/zalo/callback`;
    console.log("[Zalo] Redirect URI:", redirectUri);

    const params = new URLSearchParams({
      app_id: appId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      state,
    });

    const zaloUrl = `https://oauth.zaloapp.com/v4/permission?${params.toString()}`;
    console.log("[Zalo] Redirecting to:", zaloUrl);

    const response = NextResponse.redirect(zaloUrl);

    // Store verifier and state in cookies for callback verification
    response.cookies.set("zalo_verifier", codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    response.cookies.set("zalo_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[Zalo] Error in OAuth init:", error);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(
      new URL(`/auth/error?error=${encodeURIComponent(String(error))}`, appUrl)
    );
  }
}
