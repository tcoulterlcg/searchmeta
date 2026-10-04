import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushToUser } from "./push";
import { SOURCES, type SourceId } from "./types";

/** How long each site can go without a successful check before we call it down, in minutes. */
const STALE_AFTER: Partial<Record<SourceId, number>> = {
  fanatics: 30, goldin: 45, mycardpost: 30, myslabs: 45, collectorcrypt: 45, ebay: 30,
  sothebys: 180, sirius: 180, wheatland: 180, brockelman: 180, sterling: 180, detroitcity: 180,
};
/** A site must be failing this long before anyone is woken up; one bad check is normal. */
const CONFIRM_MS = 15 * 60_000;
/** While a site stays down, remind once a day. */
const REMIND_MS = 24 * 60 * 60_000;

const nameOf = (id: string) => SOURCES.find((s) => s.id === id)?.name ?? id;

export interface Problem {
  source: string;
  reason: string;
}

/** Sites we expect to be working. eBay only counts once its keys are in place. */
function monitored(): SourceId[] {
  return (Object.keys(STALE_AFTER) as SourceId[]).filter(
    (s) => s !== "ebay" || Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET),
  );
}

export async function findProblems(db: SupabaseClient): Promise<Problem[]> {
  const sources = monitored();
  const { data, error } = await db.from("crawl_state").select("source, last_run_at, last_status").in("source", sources);
  if (error) return [{ source: "database", reason: `Could not read site status: ${error.message}` }];
  const bySource = new Map((data ?? []).map((r) => [r.source as string, r]));
  const problems: Problem[] = [];
  for (const s of sources) {
    const row = bySource.get(s);
    const mins = row?.last_run_at ? (Date.now() - Date.parse(row.last_run_at)) / 60_000 : Infinity;
    if (!row || mins > (STALE_AFTER[s] ?? 60)) {
      problems.push({ source: s, reason: Number.isFinite(mins) ? `Not checked for ${Math.round(mins)} minutes` : "Never checked" });
    } else if (row.last_status && row.last_status !== "ok") {
      problems.push({ source: s, reason: String(row.last_status).replace(/^error:\s*/, "").slice(0, 200) });
    }
  }
  return problems;
}

/** Emails the owners through Resend. Returns false when no email service is set up yet. */
async function sendEmail(to: string[], subject: string, lines: string[]): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to.length) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.ALERT_EMAIL_FROM || "GrailFindr Alerts <onboarding@resend.dev>",
      to,
      subject,
      text: lines.join("\n"),
      // Flags the message as high importance in Outlook, Gmail and Apple Mail.
      headers: { "X-Priority": "1", Importance: "high", "X-MSMail-Priority": "High" },
    }),
  });
  if (!res.ok) console.error("health email failed", res.status, await res.text().catch(() => ""));
  return res.ok;
}

async function notifyOwners(db: SupabaseClient, subject: string, lines: string[]) {
  const { data: owners } = await db.from("owners").select("user_id");
  const ids = (owners ?? []).map((o) => o.user_id as string);
  const emails: string[] = process.env.ALERT_EMAIL_TO ? process.env.ALERT_EMAIL_TO.split(",").map((s) => s.trim()) : [];
  let pushes = 0;
  for (const id of ids) {
    pushes += await sendPushToUser(db, id, { title: subject, body: lines.slice(0, 4).join("\n"), url: "/settings", tag: "site-health" });
    if (!process.env.ALERT_EMAIL_TO) {
      const { data } = await db.auth.admin.getUserById(id);
      if (data.user?.email) emails.push(data.user.email);
    }
  }
  const emailed = await sendEmail(emails, subject, [...lines, "", "https://grailfindr.vercel.app/settings"]);
  return { pushes, emailed };
}

/**
 * Compares what's failing now with what was failing last time, and tells the owners about
 * anything that has been down for 15 minutes, anything still down a day later, and recoveries.
 */
export async function runHealthCheck(db: SupabaseClient, opts: { test?: boolean } = {}) {
  if (opts.test) {
    const sent = await notifyOwners(db, "🔴 GrailFindr TEST: site alarm is working", [
      "This is a test of the alarm that fires when a site stops being checked.",
      "No action needed.",
    ]);
    return { test: true, ...sent };
  }

  const problems = await findProblems(db);
  const { data: known } = await db.from("health_state").select("*");
  const before = new Map((known ?? []).map((r) => [r.source as string, r]));
  const now = Date.now();

  const toAlert: Problem[] = [];
  for (const p of problems) {
    const prev = before.get(p.source);
    if (!prev) {
      await db.from("health_state").insert({ source: p.source, reason: p.reason });
      continue;
    }
    const failingFor = now - Date.parse(prev.failing_since);
    const lastAlert = prev.alerted_at ? now - Date.parse(prev.alerted_at) : Infinity;
    if (failingFor >= CONFIRM_MS && lastAlert >= REMIND_MS) toAlert.push(p);
    else await db.from("health_state").update({ reason: p.reason }).eq("source", p.source);
  }

  const failing = new Set(problems.map((p) => p.source));
  const recovered = [...before.values()].filter((r) => !failing.has(r.source));
  for (const r of recovered) await db.from("health_state").delete().eq("source", r.source);
  const recoveredAfterAlert = recovered.filter((r) => r.alerted_at);

  let sent = { pushes: 0, emailed: false };
  if (toAlert.length) {
    const names = toAlert.map((p) => nameOf(p.source));
    const subject =
      toAlert.length === 1 ? `🔴 GrailFindr: ${names[0]} alerts have stopped` : `🔴 GrailFindr: ${toAlert.length} sites have stopped`;
    sent = await notifyOwners(db, subject, [
      ...toAlert.map((p) => `${nameOf(p.source)}: ${p.reason}`),
      "",
      "People with saved searches are not getting alerts from these sites until this is fixed.",
      "Open a chat with Claude and paste this message to get it repaired.",
    ]);
    const stamp = new Date().toISOString();
    for (const p of toAlert) await db.from("health_state").update({ alerted_at: stamp, reason: p.reason }).eq("source", p.source);
  } else if (recoveredAfterAlert.length) {
    sent = await notifyOwners(
      db,
      `🟢 GrailFindr: ${recoveredAfterAlert.map((r) => nameOf(r.source)).join(", ")} back to normal`,
      ["These sites are being checked again. No action needed."],
    );
  }

  return { checked: monitored().length, failing: problems, alerted: toAlert.map((p) => p.source), recovered: recovered.map((r) => r.source), ...sent };
}
