import Link from "next/link";
import { Wordmark } from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5">
      <div className="mb-8">
        <Wordmark />
      </div>
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-muted">That link doesn&apos;t go anywhere. It may have moved or been mistyped.</p>
      <Link href="/" className="btn-primary mt-6 w-fit">Back to GrailFindr</Link>
    </main>
  );
}
