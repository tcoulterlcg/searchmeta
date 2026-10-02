import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Set by the sign-in page when a password reset is requested, so the email link lands on "choose a new password". */
const RECOVERY_COOKIE = "sm_recovery";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  let ok = false;
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }
  const recovering = req.cookies.get(RECOVERY_COOKIE)?.value === "1";
  if (recovering) {
    const res = NextResponse.redirect(new URL(ok ? "/auth/reset" : "/login?reset=expired", req.url));
    res.cookies.delete(RECOVERY_COOKIE);
    return res;
  }
  return NextResponse.redirect(new URL("/searches", req.url));
}
