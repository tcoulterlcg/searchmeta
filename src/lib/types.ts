export type SourceId = "ebay" | "goldin" | "fanatics" | "mycardpost" | "sothebys" | "heritage";
export type BuyingFormat = "auction" | "buy_it_now" | "best_offer";

export const SOURCES: { id: SourceId; name: string }[] = [
  { id: "ebay", name: "eBay" },
  { id: "goldin", name: "Goldin" },
  { id: "fanatics", name: "Fanatics Collect" },
  { id: "mycardpost", name: "MyCardPost" },
  { id: "sothebys", name: "Sotheby's" },
  { id: "heritage", name: "Heritage" },
];

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
  updated_at: string;
}

/** A listing as normalized from any source adapter. */
export interface ListingInput {
  source: SourceId;
  external_id: string;
  title: string;
  description?: string | null;
  url: string;
  image_url?: string | null;
  price?: number | null;
  currency?: string | null;
  buying_formats: BuyingFormat[];
  graded?: boolean | null;
  free_shipping?: boolean | null;
  location_country?: string | null;
  listed_at?: string | null;
  ends_at?: string | null;
}

export interface Listing extends ListingInput {
  id: string;
  first_seen_at: string;
}

export interface Match {
  id: string;
  saved_search_id: string | null;
  label: string | null;
  listing_id: string;
  created_at: string;
  seen: boolean;
  listing: Listing;
  saved_search: { name: string } | null;
}
