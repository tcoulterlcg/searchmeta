import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SavedSearch } from "@/lib/types";
import { SearchForm } from "../SearchForm";

export default async function EditSearchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("saved_searches").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Edit search</h1>
      <SearchForm search={data as SavedSearch} />
    </div>
  );
}
