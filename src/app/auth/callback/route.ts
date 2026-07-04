import { createClient } from "@/lib/supabase/server";
import { isAuthorizedUser } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * OAuth-Callback nach GitHub-Login.
 *
 * Zwei-Stufen-Verifikation:
 *  1. Code gegen Supabase-Session eintauschen.
 *  2. User gegen Whitelist prüfen (Email + GitHub-Username).
 *     Ist die Whitelist verletzt → sofort ausloggen und zurück zu /login mit
 *     Fehler-Marker. Kein Zugriff aufs Dashboard.
 *
 * Wenn ein Admin-PIN konfiguriert ist, geht es NACH Login zu /verify-pin.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");

  // GitHub hat OAuth abgelehnt (z.B. User hat Zugriff verweigert)
  if (oauthError) {
    return NextResponse.redirect(`${origin}/login?error=oauth_${oauthError}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  const check = isAuthorizedUser(user);
  if (!check.ok) {
    // Nicht in Whitelist → Session sofort löschen
    await supabase.auth.signOut().catch(() => {});
    return NextResponse.redirect(`${origin}/login?error=${check.reason ?? 'forbidden'}`);
  }

  // Wenn PIN-Feature aktiv → erst zur PIN-Verifikation
  if (process.env.ADMIN_PIN) {
    return NextResponse.redirect(`${origin}/verify-pin`);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
