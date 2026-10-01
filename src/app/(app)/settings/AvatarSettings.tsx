"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";
import { saveAvatar } from "./actions";

const MAX_SIDE = 400;

/** Crops to a centered square and shrinks to 400px so pictures load fast. */
async function toSquareJpeg(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const out = Math.min(side, MAX_SIDE);
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that image"))), "image/jpeg", 0.88),
  );
}

/** Upload a photo, paste a screenshot, or paste an image link. */
export function AvatarSettings({ email, initialUrl }: { email: string; initialUrl: string | null }) {
  const [url, setUrl] = useState("");
  const [current, setCurrent] = useState(initialUrl ?? "");
  const [broken, setBroken] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  function persist(next: string | null, done: string) {
    start(async () => {
      const r = await saveAvatar(next);
      if (!r.ok) setMsg(r.error ?? "Couldn't save");
      else {
        setCurrent(next ?? "");
        setUrl("");
        setMsg(done);
      }
    });
  }

  async function upload(file: Blob) {
    setMsg(null);
    if (!file.type.startsWith("image/")) {
      setMsg("That file isn't an image.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const jpeg = await toSquareJpeg(file);
      const path = `${user.id}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("avatars").upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setBroken(false);
      persist(data.publicUrl, "Saved ✓");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  // Paste a screenshot (Ctrl/Cmd+V) anywhere on the Settings page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        upload(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const linkPreview = url.trim().startsWith("https://") && !broken ? url.trim() : null;
  const shown = linkPreview ?? (current || null);
  const working = busy || pending;

  return (
    <section className="rounded-xl border border-line bg-panel p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">Profile picture</div>

      <div
        className="mt-3 flex items-center gap-4"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
      >
        <Avatar email={email} url={shown} size={64} onError={() => linkPreview && setBroken(true)} />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" disabled={working} onClick={() => fileInput.current?.click()}>
            {busy ? "Uploading…" : "Upload photo"}
          </button>
          {current && (
            <button type="button" className="btn-ghost" disabled={working} onClick={() => persist(null, "Removed")}>
              Remove
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">Upload a photo, drag one here, or paste a screenshot (Ctrl/Cmd + V).</p>

      <div className="mt-4 flex gap-2">
        <label htmlFor="avatar-url" className="sr-only">Image link</label>
        <input
          id="avatar-url"
          className="input"
          type="url"
          inputMode="url"
          placeholder="…or paste an image link (https://…)"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setBroken(false);
            setMsg(null);
          }}
        />
        <button
          type="button"
          className="btn-ghost shrink-0"
          disabled={working || broken || !linkPreview}
          onClick={() => persist(url.trim(), "Saved ✓")}
        >
          Use link
        </button>
      </div>
      {broken && url.trim() && <p className="mt-2 text-sm text-warn">That link isn&apos;t an image we can show. Try another.</p>}
      {msg && <p className="mt-2 text-sm text-muted">{msg}</p>}
    </section>
  );
}
