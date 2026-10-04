"use client";

import { useState } from "react";
import { usePush } from "@/components/EnablePush";

export function PushSettings() {
  const { state, enable, disable, test } = usePush();
  const [sent, setSent] = useState(false);

  return (
    <section className="rounded-xl border border-line bg-panel p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">Push notifications on this device</div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-sm">
          {state === "on" && "On"}
          {state === "off" && "Off"}
          {state === "denied" && "Blocked in device settings"}
          {state === "needs-install" && "Add GrailFindr to your Home Screen first"}
          {state === "unsupported" && "Not supported in this browser"}
          {state === "loading" && "…"}
        </span>
        {state === "off" && <button onClick={enable} className="btn-primary">Turn on</button>}
        {state === "on" && (
          <div className="flex gap-2">
            <button onClick={async () => { await test(); setSent(true); }} className="btn-ghost">
              {sent ? "Sent ✓" : "Send test"}
            </button>
            <button onClick={disable} className="btn-ghost">Turn off</button>
          </div>
        )}
      </div>
    </section>
  );
}
