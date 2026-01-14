import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";

/**
 * This route acts as a click-through gate for email verification links.
 * It redirects to a confirmation page that requires user interaction,
 * preventing email security scanners from consuming single-use tokens.
 *
 * Flow:
 * 1. Email contains link to /auth/verify?token=...&type=...
 * 2. This route redirects to /en/auth/verify?url=<encoded-supabase-url>
 * 3. User clicks "Confirm" button on that page
 * 4. Browser redirects to actual Supabase verification URL
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const type = url.searchParams.get("type") || "magiclink";
  const redirectTo = url.searchParams.get("redirect_to") || `${url.origin}/auth/callback`;

  if (!token) {
    return NextResponse.redirect(new URL("/en/auth/error?error=No token provided", url.origin));
  }

  // Build the actual Supabase verification URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const verifyUrl = `${supabaseUrl}/auth/v1/verify?token=${token}&type=${type}&redirect_to=${encodeURIComponent(redirectTo)}`;

  // Redirect to our confirmation page with the encoded verification URL
  const confirmPageUrl = new URL("/en/auth/verify", url.origin);
  confirmPageUrl.searchParams.set("url", encodeURIComponent(verifyUrl));

  return NextResponse.redirect(confirmPageUrl);
}
