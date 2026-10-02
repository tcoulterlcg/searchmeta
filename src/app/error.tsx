"use client";

/** Shown if a page fails to load, instead of a blank or technical error screen. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-muted">That didn&apos;t load. Try again, and if it keeps happening email support@grailio.app.</p>
      <button type="button" onClick={reset} className="btn-primary mt-6 w-fit">Try again</button>
    </main>
  );
}
