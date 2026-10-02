"use client";

import { useRouter } from "next/navigation";
import { Dropdown } from "@/components/Dropdown";

const OPTIONS = [
  { value: "recent", label: "Most recent" },
  { value: "high", label: "Price: high → low" },
  { value: "low", label: "Price: low → high" },
];

export function SoldSort({ query, sort }: { query: string; sort: string }) {
  const router = useRouter();
  return (
    <Dropdown
      ariaLabel="Sort sales"
      className="w-48"
      options={OPTIONS}
      value={OPTIONS.some((o) => o.value === sort) ? sort : "recent"}
      onChange={([v]) => router.push(`/sold?q=${encodeURIComponent(query)}&sort=${v}`)}
    />
  );
}
