import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { SISTER_APPS, safePath } from "@/lib/apps";

/**
 * "Continue with GrailFindr": signs the current GrailFindr user into a sister app.
 *
 * /connect?app=cardhq&next=/some/page
 *  - Not signed in → GrailFindr sign-in, then back here.
 *  - Signed in → mints a one-time sign-in token (no email is sent) and hands it to the
 *    sister app's handoff page in the URL fragment, so it never reaches a server log.
 *    The sister app gets its own session; GrailFindr's session is untouched.
 */
export async function GET(req: NextRequest) {
  const app = SISTER_APPS[req.nextUrl.searchParams.get("app") ?? ""];
  if (!app) return NextResponse.redirect(new URL("/", req.url));
  const next = safePath(req.nextUrl.searchParams.get("next"));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    const back = `/connect?app=${app.id}&next=${encodeURIComponent(next)}`;
    const login = new URL("/login", req.url);
    login.searchParams.set("next", back);
    login.searchParams.set("app", app.id);
    return NextResponse.redirect(login);
  }

  const { data, error } = await createServiceClient().auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    return NextResponse.redirect(`${app.url}${app.handoffPath}#error=${encodeURIComponent("Couldn't sign you in. Try again.")}`);
  }

  const frag = new URLSearchParams({ token_hash: tokenHash, next });
  return NextResponse.redirect(`${app.url}${app.handoffPath}#${frag.toString()}`);
}
