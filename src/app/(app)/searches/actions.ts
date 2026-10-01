"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseQuery } from "@/lib/query";

const ALL_SOURCES = ["ebay", "goldin", "fanatics", "mycardpost", "heritage"];
const FORMATS = ["auction", "buy_it_now", "best_offer"];

function num(v: FormDataEntryValue | null) {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(String(v).replace(/[$,]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function saveSearch(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const keywords = String(formData.get("keywords") ?? "").trim();
  if (!keywords || parseQuery(keywords).clauses.every((c) => c.neg)) {
    throw new Error("Enter at least one keyword to search for.");
  }

  const sources = formData.getAll("sources").map(String).filter((s) => ALL_SOURCES.includes(s));
  const row = {
    user_id: user.id,
    name: String(formData.get("name") ?? "").trim() || keywords.slice(0, 60),
    keywords,
    search_description: formData.get("search_description") === "on",
    sources: sources.length ? sources : ALL_SOURCES,
    min_price: num(formData.get("min_price")),
    max_price: num(formData.get("max_price")),
    buying_formats: formData.getAll("buying_formats").map(String).filter((f) => FORMATS.includes(f)),
    condition: ["graded", "ungraded"].includes(String(formData.get("condition"))) ? String(formData.get("condition")) : "any",
    free_shipping: formData.get("free_shipping") === "on",
    located_in: formData.get("located_in") === "US" ? "US" : null,
    notify: formData.get("notify") !== "off",
    updated_at: new Date().toISOString(),
  };

  const id = formData.get("id");
  if (id) {
    const { error } = await supabase.from("saved_searches").update(row).eq("id", String(id));
    if (error) throw error;
  } else {
    const { error } = await supabase.from("saved_searches").insert(row);
    if (error) throw error;
  }
  revalidatePath("/searches");
  redirect("/searches");
}

export async function deleteSearch(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("saved_searches").delete().eq("id", String(formData.get("id")));
  revalidatePath("/searches");
  redirect("/searches");
}

export async function toggleNotify(id: string, notify: boolean) {
  const supabase = await createClient();
  await supabase.from("saved_searches").update({ notify }).eq("id", id);
  revalidatePath("/searches");
}
