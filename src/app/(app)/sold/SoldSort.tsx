"use client";

import { useRouter } from "next/navigation";
import { Dropdown } from "@/components/Dropdown";

const OPTIONS = [
  { value: "recent", label: "Newest first" },
  { value: "high", label: "Price: high → low" },
  { value: "low", label: "Price: low → high" },
];

export function SoldSort({ query, sort, mode }: { query: string; sort: string; mode: "live" | "sold" }) {
  const router = useRouter();
  return (
    <Dropdown
      ariaLabel="Sort results"
      className="w-48"
      options={OPTIONS}
      value={OPTIONS.some((o) => o.value === sort) ? sort : "recent"}
      onChange={([v]) => router.push(`/sold?mode=${mode}&q=${encodeURIComponent(query)}&sort=${v}`)}
    />
  );
}
