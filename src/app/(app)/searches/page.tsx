import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { SavedSearch } from "@/lib/types";
import { SearchCard, type SearchStats } from "./SearchCard";

export default async function SearchesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("saved_searches").select("*").order("created_at", { ascending: false });
  const searches = (data ?? []) as SavedSearch[];

  // How many alerts each search has found, and when the latest one came in.
  const stats = new Map<string, SearchStats>(
    await Promise.all(
      searches.map(async (s) => {
        const { data: latest, count } = await supabase
          .from("matches")
          .select("created_at", { count: "exact" })
          .eq("saved_search_id", s.id)
          .order("created_at", { ascending: false })
          .limit(1);
        return [s.id, { matches: count ?? 0, lastMatchAt: latest?.[0]?.created_at ?? null }] as const;
      }),
    ),
  );

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Saved searches</h1>
        <Link href="/searches/new" className="btn-primary">+ New</Link>
      </div>

      {searches.length === 0 && (
        <div className="rounded-xl border border-dashed border-line p-8 text-center">
          <p className="font-semibold">No saved searches yet</p>
          <p className="mt-1 text-sm text-muted">Save a search and we&apos;ll watch every auction house for it.</p>
          <Link href="/searches/new" className="btn-primary mt-4">Create your first search</Link>
        </div>
      )}

      <ul className="space-y-3">
        {searches.map((s) => (
          <SearchCard key={s.id} search={s} stats={stats.get(s.id)} />
        ))}
      </ul>
    </div>
  );
}
