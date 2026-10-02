export type SourceId =
  | "ebay" | "goldin" | "fanatics" | "mycardpost" | "sothebys" | "heritage"
  | "myslabs" | "collectorcrypt"
  | "lelands" | "memorylane" | "lotg" | "collectauctions"
  | "sirius" | "wheatland" | "brockelman" | "sterling" | "detroitcity";
export type BuyingFormat = "auction" | "buy_it_now" | "best_offer";

export const SOURCES: { id: SourceId; name: string }[] = [
  { id: "ebay", name: "eBay" },
  { id: "goldin", name: "Goldin" },
  { id: "fanatics", name: "Fanatics Collect" },
  { id: "mycardpost", name: "MyCardPost" },
  { id: "sothebys", name: "Sotheby's" },
  { id: "heritage", name: "Heritage" },
  { id: "myslabs", name: "MySlabs" },
  { id: "sirius", name: "Sirius Sports Cards" },
  { id: "wheatland", name: "Wheatland" },
  { id: "brockelman", name: "Brockelman" },
  { id: "sterling", name: "Sterling Sports" },
  { id: "detroitcity", name: "Detroit City Sports" },
  { id: "collectorcrypt", name: "Collector Crypt" },
];

/**
 * Readers that are built but not switched on, so they are not offered in the app.
 * To switch one on: move it into SOURCES, add its row to the `sources` table, add it to
 * existing saved searches, and schedule its check.
 */
export const PENDING_SOURCES: { id: SourceId; name: string }[] = [];

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
  /** "instant" pushes each match as it appears; "feed" sends one daily summary. */
  delivery: "instant" | "feed";
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
  starred: boolean;
  listing: Listing;
  saved_search: { name: string } | null;
}

/** One completed sale for the Sold (comps) archive. */
export interface SaleInput {
  source: SourceId;
  external_id: string;
  title: string;
  url: string;
  image_url: string | null;
  price: number | null;
  sale_type: string;
  sold_at: string | null;
}
