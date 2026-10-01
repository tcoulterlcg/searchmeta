import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { parseHeritageEmail } from "@/lib/sources/heritage-email";
import { sendPushToUser } from "@/lib/push";

export const dynamic = "force-dynamic";

/**
 * Inbound email webhook (Postmark inbound format).
 * Each user forwards their Heritage alert emails to <inbox>+<their token>@...
 * We read the token from the address, pull Heritage lots out of the email, and alert them.
 */

interface InboundEmail {
  From?: string;
  To?: string;
  OriginalRecipient?: string;
  MailboxHash?: string;
  Subject?: string;
  HtmlBody?: string;
  TextBody?: string;
  ToFull?: { Email: string; MailboxHash?: string }[];
}

function findToken(e: InboundEmail): string | null {
  if (e.MailboxHash) return e.MailboxHash.toLowerCase();
  for (const f of e.ToFull ?? []) if (f.MailboxHash) return f.MailboxHash.toLowerCase();
  const addr = `${e.OriginalRecipient ?? ""} ${e.To ?? ""}`;
  return addr.match(/\+([a-z0-9]+)@/i)?.[1]?.toLowerCase() ?? null;
}

export async function POST(req: NextRequest) {
  const secret = process.env.INBOUND_EMAIL_SECRET;
  if (!secret || req.nextUrl.searchParams.get("key") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const email = (await req.json()) as InboundEmail;
  const token = findToken(email);
  // Always 200 so the email provider doesn't retry forever on unknown addresses.
  if (!token) return NextResponse.json({ ok: true, ignored: "no token" });

  const db = createServiceClient();
  const { data: profile } = await db.from("profiles").select("id").eq("inbound_token", token).maybeSingle();
  if (!profile) return NextResponse.json({ ok: true, ignored: "unknown token" });
  const userId = profile.id as string;

  const listings = parseHeritageEmail(email.HtmlBody ?? "", email.TextBody ?? "");
  const snippet = (email.TextBody ?? email.HtmlBody?.replace(/<[^>]+>/g, " ") ?? "").replace(/\s+/g, " ").trim().slice(0, 600);

  await db.from("inbound_emails").insert({
    user_id: userId,
    from_address: email.From ?? null,
    subject: email.Subject ?? null,
    snippet,
    items_found: listings.length,
  });

  if (listings.length === 0) return NextResponse.json({ ok: true, items: 0 });

  await db.from("listings").upsert(listings, { onConflict: "source,external_id", ignoreDuplicates: true });
  const { data: rows } = await db
    .from("listings")
    .select("id, external_id")
    .eq("source", "heritage")
    .in("external_id", listings.map((l) => l.external_id));
  const idByExternal = new Map((rows ?? []).map((r) => [r.external_id as string, r.id as string]));

  // Skip lots this user was already alerted about from an earlier email.
  const listingIds = [...idByExternal.values()];
  const { data: already } = await db
    .from("matches")
    .select("listing_id")
    .eq("user_id", userId)
    .is("saved_search_id", null)
    .in("listing_id", listingIds);
  const seen = new Set((already ?? []).map((r) => r.listing_id as string));
  const fresh = listingIds.filter((id) => !seen.has(id));

  const { data: inserted } = fresh.length
    ? await db
        .from("matches")
        .insert(fresh.map((listing_id) => ({ user_id: userId, listing_id, label: "Heritage alert" })))
        .select("id, listing_id")
    : { data: [] as { id: string; listing_id: string }[] };

  let pushes = 0;
  for (const row of inserted ?? []) {
    const l = listings.find((x) => idByExternal.get(x.external_id) === row.listing_id);
    if (!l) continue;
    pushes += await sendPushToUser(db, userId, {
      title: "Heritage alert",
      body: l.title,
      url: l.url,
      image: l.image_url,
      tag: `heritage-${l.external_id}`,
    });
  }
  if (inserted?.length) {
    await db.from("matches").update({ notified_at: new Date().toISOString() }).in("id", inserted.map((r) => r.id));
  }

  return NextResponse.json({ ok: true, items: listings.length, newMatches: inserted?.length ?? 0, pushes });
}
