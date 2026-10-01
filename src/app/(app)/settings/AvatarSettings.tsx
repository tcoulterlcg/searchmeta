"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/Avatar";
import { saveAvatar } from "./actions";

/** Paste an image link from the internet to use as your profile picture. */
export function AvatarSettings({ email, initialUrl }: { email: string; initialUrl: string | null }) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [saved, setSaved] = useState(initialUrl ?? "");
  const [broken, setBroken] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const preview = url.trim().startsWith("https://") && !broken ? url.trim() : null;

  function save(next: string | null) {
    setMsg(null);
    start(async () => {
      const r = await saveAvatar(next);
      if (!r.ok) setMsg(r.error ?? "Couldn't save");
      else {
        setSaved(next ?? "");
        if (!next) setUrl("");
        setMsg(next ? "Saved ✓" : "Removed");
      }
    });
  }

  return (
    <section className="rounded-xl border border-line bg-panel p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">Profile picture</div>
      <div className="mt-3 flex items-center gap-4">
        <Avatar email={email} url={preview} size={56} onError={() => setBroken(true)} />
        <div className="min-w-0 flex-1">
          <label htmlFor="avatar-url" className="sr-only">Image link</label>
          <input
            id="avatar-url"
            className="input"
            type="url"
            inputMode="url"
            placeholder="Paste an image link (https://…)"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setBroken(false);
              setMsg(null);
            }}
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        Right-click any image online, choose <b className="text-text">Copy Image Address</b>, and paste it here.
      </p>
      {broken && url.trim() && <p className="mt-2 text-sm text-warn">That link isn&apos;t an image we can show. Try another.</p>}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          className="btn-primary"
          disabled={pending || broken || !preview || url.trim() === saved}
          onClick={() => save(url.trim())}
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {saved && (
          <button type="button" className="text-sm text-muted hover:text-text" disabled={pending} onClick={() => save(null)}>
            Remove
          </button>
        )}
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
    </section>
  );
}
