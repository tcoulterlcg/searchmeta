import Link from "next/link";
import { SOURCES, type SavedSearch } from "@/lib/types";
import { deleteSearch, saveSearch } from "./actions";

const FORMATS = [
  { id: "auction", label: "Auction" },
  { id: "buy_it_now", label: "Buy It Now" },
  { id: "best_offer", label: "Accepts Offers" },
];

export function SearchForm({ search }: { search?: SavedSearch }) {
  const s = search;
  const sources = s?.sources ?? SOURCES.map((x) => x.id);

  return (
    <div>
      <form action={saveSearch} className="space-y-6">
        {s && <input type="hidden" name="id" value={s.id} />}

        <Field label="Keywords">
          <input name="keywords" className="input font-mono" required defaultValue={s?.keywords}
            placeholder='kucherov shield -reprint' autoCapitalize="none" autoCorrect="off" />
          <details className="mt-2 text-sm text-muted">
            <summary className="cursor-pointer">Search tips (same as eBay)</summary>
            <ul className="mt-2 space-y-1 font-mono text-xs">
              <li><b className="text-text">kucherov shield</b> all words, any order</li>
              <li><b className="text-text">&quot;logo patch&quot;</b> exact phrase</li>
              <li><b className="text-text">-reprint</b> exclude a word</li>
              <li><b className="text-text">(psa,bgs,sgc)</b> any of these</li>
              <li><b className="text-text">-(digital,custom)</b> none of these</li>
              <li><b className="text-text">kuch*</b> word starts with</li>
            </ul>
          </details>
          <label className="mt-3 flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="search_description" defaultChecked={s?.search_description}
              className="h-4 w-4 accent-[#3ef08a]" />
            Include description in search
          </label>
        </Field>

        <Field label="Name (optional)">
          <input name="name" className="input" defaultValue={s?.name} placeholder="Kucherov Shield" />
        </Field>

        <Field label="Sites">
          <div className="flex flex-wrap gap-2">
            {SOURCES.map((src) => (
              <ChipCheck key={src.id} name="sources" value={src.id} label={src.name} defaultChecked={sources.includes(src.id)} />
            ))}
          </div>
        </Field>

        <Field label="Price">
          <div className="flex items-center gap-2">
            <input name="min_price" inputMode="decimal" className="input" placeholder="$ Min" defaultValue={s?.min_price ?? ""} />
            <span className="text-muted">to</span>
            <input name="max_price" inputMode="decimal" className="input" placeholder="$ Max" defaultValue={s?.max_price ?? ""} />
          </div>
        </Field>

        <Field label="Buying format">
          <div className="flex flex-wrap gap-2">
            {FORMATS.map((f) => (
              <ChipCheck key={f.id} name="buying_formats" value={f.id} label={f.label}
                defaultChecked={s?.buying_formats.includes(f.id as never) ?? false} />
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">None selected = all formats</p>
        </Field>

        <Field label="Condition">
          <div className="flex flex-wrap gap-2">
            {[{ id: "any", label: "Any" }, { id: "graded", label: "Graded" }, { id: "ungraded", label: "Ungraded" }].map((c) => (
              <label key={c.id} className="chip has-[:checked]:border-signal has-[:checked]:bg-signal/10 has-[:checked]:text-signal">
                <input type="radio" name="condition" value={c.id} className="sr-only"
                  defaultChecked={(s?.condition ?? "any") === c.id} />
                {c.label}
              </label>
            ))}
          </div>
        </Field>

        <Field label="Shipping & location">
          <div className="flex flex-wrap gap-2">
            <ChipCheck name="free_shipping" value="on" label="Free shipping" defaultChecked={s?.free_shipping ?? false} />
            <ChipCheck name="located_in" value="US" label="US only" defaultChecked={s?.located_in === "US"} />
          </div>
        </Field>

        <Field label="Notifications">
          <label className="flex items-center justify-between rounded-lg border border-line bg-panel px-3 py-3 text-sm">
            Push me when a new match is listed
            <select name="notify" defaultValue={s?.notify === false ? "off" : "on"}
              className="rounded bg-ink px-2 py-1 text-text">
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </label>
        </Field>

        <div className="flex gap-3">
          <button className="btn-primary flex-1">{s ? "Save changes" : "Save search"}</button>
          <Link href="/searches" className="btn-ghost">Cancel</Link>
        </div>
      </form>

      {s && (
        <form action={deleteSearch} className="mt-8 border-t border-line pt-6">
          <input type="hidden" name="id" value={s.id} />
          <button className="text-sm font-medium text-red-400 hover:text-red-300">Delete this search</button>
        </form>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{label}</div>
      {children}
    </div>
  );
}

function ChipCheck({ name, value, label, defaultChecked }: { name: string; value: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="chip has-[:checked]:border-signal has-[:checked]:bg-signal/10 has-[:checked]:text-signal">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="sr-only" />
      {label}
    </label>
  );
}
