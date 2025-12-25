import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const storedState = request.cookies.get("zalo_state")?.value;
  const codeVerifier = request.cookies.get("zalo_verifier")?.value;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Check for OAuth errors
  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/auth/error?error=${encodeURIComponent(errorParam)}`, appUrl)
    );
  }

  // Validate state to prevent CSRF
  if (!state || state !== storedState) {
    return NextResponse.redirect(
      new URL("/auth/error?error=invalid_state", appUrl)
    );
  }

  if (!code || !codeVerifier) {
    return NextResponse.redirect(
      new URL("/auth/error?error=missing_code_or_verifier", appUrl)
    );
  }

  const appId = process.env.NEXT_PUBLIC_ZALO_APP_ID;
  const appSecret = process.env.ZALO_APP_SECRET;

  if (!appId || !appSecret) {
    return NextResponse.redirect(
      new URL("/auth/error?error=zalo_not_configured", appUrl)
    );
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch("https://oauth.zaloapp.com/v4/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        secret_key: appSecret,
      },
      body: new URLSearchParams({
        app_id: appId,
        code,
        code_verifier: codeVerifier,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error || !tokenData.access_token) {
      console.error("Zalo token error:", tokenData);
      return NextResponse.redirect(
        new URL(
          `/auth/error?error=${encodeURIComponent(tokenData.error_description || "token_exchange_failed")}`,
          appUrl
        )
      );
    }

    // Pass token to client via URL hash (client will fetch user info to bypass geo-restriction)
    const response = NextResponse.redirect(
      new URL(
        `/auth/zalo-complete#access_token=${tokenData.access_token}`,
        appUrl
      )
    );

    // Clear the cookies
    response.cookies.delete("zalo_verifier");
    response.cookies.delete("zalo_state");

    return response;
  } catch (error) {
    console.error("Zalo callback error:", error);
    return NextResponse.redirect(
      new URL("/auth/error?error=token_exchange_failed", appUrl)
    );
  }
}
