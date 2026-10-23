import { SearchForm } from "../SearchForm";

// /searches/new?keywords=...&name=... opens the form pre-filled (Card HQ links here from each card).
export default async function NewSearchPage({ searchParams }: { searchParams: Promise<{ keywords?: string; name?: string }> }) {
  const sp = await searchParams;
  const clip = (v?: string) => (typeof v === "string" ? v.slice(0, 200) : undefined);
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">New saved search</h1>
      <SearchForm prefill={{ keywords: clip(sp.keywords), name: clip(sp.name) }} />
    </div>
  );
}
