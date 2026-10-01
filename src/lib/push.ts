import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:support@searchmeta.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  image?: string | null;
  tag?: string;
}

/** Sends a browser push to every web device the user has registered. Removes dead subscriptions. */
async function sendWebPush(db: SupabaseClient, userId: string, payload: PushPayload) {
  configure();
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 3600, urgency: "high" },
      );
      sent++;
    } catch (err: unknown) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
      else console.error("web push failed", code, err);
    }
  }
  return sent;
}

/** Sends a native push (iPhone/Android app) through Expo's push service. Removes dead tokens. */
async function sendAppPush(db: SupabaseClient, userId: string, payload: PushPayload) {
  const { data: devices } = await db.from("device_tokens").select("id, token").eq("user_id", userId);
  if (!devices?.length) return 0;

  const messages = devices.map((d) => ({
    to: d.token,
    title: payload.title,
    body: payload.body,
    sound: "default",
    priority: "high",
    data: { url: payload.url },
    ...(payload.tag ? { collapseId: payload.tag } : {}),
  }));

  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers,
      body: JSON.stringify(messages),
    });
    const json = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
    let sent = 0;
    const dead: string[] = [];
    (json.data ?? []).forEach((ticket, i) => {
      if (ticket.status === "ok") sent++;
      else if (ticket.details?.error === "DeviceNotRegistered") dead.push(devices[i].id);
    });
    if (dead.length) await db.from("device_tokens").delete().in("id", dead);
    return sent;
  } catch (err) {
    console.error("app push failed", err);
    return 0;
  }
}

/** Sends an alert to every device the user has: the app and any browsers. */
export async function sendPushToUser(db: SupabaseClient, userId: string, payload: PushPayload) {
  const [web, app] = await Promise.all([sendWebPush(db, userId, payload), sendAppPush(db, userId, payload)]);
  return web + app;
}
