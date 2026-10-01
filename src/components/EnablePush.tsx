"use client";

import { useEffect, useState } from "react";

type State = "loading" | "unsupported" | "needs-install" | "off" | "on" | "denied";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function usePush() {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    (async () => {
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState(isIOS && !standalone ? "needs-install" : "unsupported");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      if (Notification.permission === "denied") return setState("denied");
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    const reg = await navigator.serviceWorker.ready;
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return setState("denied");
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    });
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    setState("on");
  }

  async function disable() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    setState("off");
  }

  async function test() {
    await fetch("/api/push/test", { method: "POST" });
  }

  return { state, enable, disable, test };
}

export function EnablePushBanner() {
  const { state, enable } = usePush();
  if (state === "on" || state === "loading") return null;
  if (state === "unsupported") {
    return (
      <div className="mb-5 rounded-xl border border-line bg-panel p-4 text-sm text-muted">
        Push alerts aren&apos;t available in this browser. On iPhone, open SearchMeta in <b className="text-text">Safari</b>,
        tap <b className="text-text">Share → Add to Home Screen</b>, then open it from your Home Screen (iOS 16.4 or newer).
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-xl border border-signal-dim bg-signal/5 p-4">
      {state === "needs-install" ? (
        <>
          <p className="font-semibold">Get alerts on your iPhone</p>
          <p className="mt-1 text-sm text-muted">
            Tap the <b className="text-text">Share</b> button, then <b className="text-text">Add to Home Screen</b>. Open
            SearchMeta from your home screen to turn on notifications.
          </p>
        </>
      ) : state === "denied" ? (
        <p className="text-sm text-muted">Notifications are blocked. Turn them on for SearchMeta in your device settings.</p>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Turn on push alerts</p>
            <p className="text-sm text-muted">Know the second your card is listed.</p>
          </div>
          <button onClick={enable} className="btn-primary shrink-0">Enable</button>
        </div>
      )}
    </div>
  );
}
