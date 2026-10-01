"use client";

import { useState } from "react";

/** Round profile picture, falling back to the email's first letter. */
export function Avatar({
  email,
  url,
  size = 36,
  onError,
}: {
  email: string;
  url: string | null;
  size?: number;
  onError?: () => void;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const show = url && failed !== url;
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-panel font-semibold text-text"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => {
            setFailed(url);
            onError?.();
          }}
        />
      ) : (
        (email[0] ?? "?").toUpperCase()
      )}
    </span>
  );
}
