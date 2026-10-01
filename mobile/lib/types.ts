export type SourceId = "ebay" | "goldin" | "fanatics" | "mycardpost" | "sothebys" | "heritage";
export type BuyingFormat = "auction" | "buy_it_now" | "best_offer";

export const SOURCES: { id: SourceId; name: string }[] = [
  { id: "ebay", name: "eBay" },
  { id: "goldin", name: "Goldin" },
  { id: "fanatics", name: "Fanatics" },
  { id: "mycardpost", name: "MyCardPost" },
  { id: "sothebys", name: "Sotheby's" },
  { id: "heritage", name: "Heritage" },
];

export const sourceName = (id: string) => SOURCES.find((s) => s.id === id)?.name ?? id;

export interface SavedSearch {
  id: string;
  user_id: string;
  name: string;
  keywords: string;
  search_description: boolean;
  sources: SourceId[];
  min_price: number | null;
  max_price: number | null;
  buying_formats: BuyingFormat[];
  condition: "any" | "graded" | "ungraded";
  free_shipping: boolean;
  located_in: string | null;
  notify: boolean;
  created_at: string;
}

export interface Listing {
  id: string;
  source: SourceId;
  title: string;
  url: string;
  image_url: string | null;
  price: number | null;
  buying_formats: string[];
  ends_at: string | null;
}

export interface Match {
  id: string;
  saved_search_id: string | null;
  label: string | null;
  created_at: string;
  seen: boolean;
  listing: Listing;
  saved_search: { name: string } | null;
}
