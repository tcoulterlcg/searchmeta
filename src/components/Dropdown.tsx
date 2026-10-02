"use client";

import { useEffect, useRef, useState } from "react";

export interface DropdownOption {
  value: string;
  label: string;
  /** Shown but can't be picked, with this note beside it (e.g. "In Development"). */
  note?: string;
  disabled?: boolean;
  /** Shows a bin on this row (needs `onRemove`). */
  removable?: boolean;
}

interface Props {
  options: DropdownOption[];
  /** Controlled value. Leave out (and use `defaultValue`) inside a plain form. */
  value?: string | string[];
  defaultValue?: string | string[];
  onChange?: (value: string[]) => void;
  /** Called after the person confirms the bin on a removable row. */
  onRemove?: (value: string) => void;
  /** Let several options be ticked at once. */
  multiple?: boolean;
  /** Multi-select only: what the box says when nothing, or everything, is ticked. */
  allLabel?: string;
  /** Multi-select only: the word after the count, e.g. "3 sites". */
  unit?: string;
  /** Submits the selection with a form under this field name. */
  name?: string;
  ariaLabel: string;
  className?: string;
  /** Which edge of the box the list lines up with. */
  align?: "left" | "right";
}

const toList = (v: string | string[] | undefined) => (v == null ? [] : Array.isArray(v) ? v : [v]);

/**
 * The one dropdown used across the site, so every picker looks and behaves the same
 * whether it takes a single choice or several.
 */
export function Dropdown({
  options, value, defaultValue, onChange, onRemove, multiple = false, allLabel = "All", unit = "selected",
  name, ariaLabel, className = "", align = "left",
}: Props) {
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState<string[]>(toList(defaultValue));
  const selected = value !== undefined ? toList(value) : inner;
  const ref = useRef<HTMLDivElement>(null);
  /** The row whose bin was tapped and is waiting for a yes or no. */
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setRemoving(null);
      return;
    }
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(v: string) {
    let next: string[];
    if (multiple) {
      next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    } else {
      next = [v];
      setOpen(false);
    }
    setInner(next);
    onChange?.(next);
  }

  const pickable = options.filter((o) => !o.disabled);
  const chosen = pickable.filter((o) => selected.includes(o.value));
  const label = multiple
    ? chosen.length === 0 || chosen.length === pickable.length
      ? allLabel
      : chosen.length === 1
        ? chosen[0].label
        : `${chosen.length} ${unit}`
    : chosen[0]?.label ?? options[0]?.label ?? "";
  const narrowed = multiple && chosen.length > 0 && chosen.length < pickable.length;

  return (
    <div ref={ref} className={`relative ${className}`}>
      {name && chosen.map((o) => <input key={o.value} type="hidden" name={name} value={o.value} />)}
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`input flex cursor-pointer items-center justify-between gap-3 text-left ${open ? "border-signal" : ""} ${narrowed ? "border-signal text-signal" : ""}`}
      >
        <span className="truncate">{label}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M2.5 4.5 6 8l3.5-3.5" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          aria-multiselectable={multiple}
          className={`absolute z-30 mt-1.5 max-h-80 w-max min-w-full max-w-[calc(100vw-2.5rem)] overflow-auto rounded-lg border border-line bg-panel p-1 shadow-2xl shadow-black/40 ${align === "right" ? "right-0" : "left-0"}`}
        >
          {options.map((o) => {
            const on = !o.disabled && selected.includes(o.value);
            if (removing === o.value) {
              return (
                <div key={o.value} className="flex items-center justify-between gap-4 rounded-md bg-ink px-3 py-2.5 text-[15px]">
                  <span className="truncate text-muted">Delete “{o.label}”?</span>
                  <span className="flex shrink-0 items-center gap-4 text-sm">
                    <button type="button" className="font-semibold text-red-500 hover:text-red-400"
                      onClick={() => { setRemoving(null); onRemove?.(o.value); }}>
                      Delete
                    </button>
                    <button type="button" className="text-muted hover:text-text" onClick={() => setRemoving(null)}>Cancel</button>
                  </span>
                </div>
              );
            }
            return (
              <div key={o.value} className="flex items-center rounded-md transition hover:bg-ink">
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  disabled={o.disabled}
                  onClick={() => pick(o.value)}
                  className={`flex min-w-0 flex-1 items-center justify-between gap-6 px-3 py-2.5 text-left text-[15px] ${
                    o.disabled ? "cursor-default text-muted/70" : on ? "text-signal" : "text-text"
                  }`}
                >
                  <span className="whitespace-nowrap">
                    {o.label}
                    {o.note && <span className="ml-2 text-xs text-muted">{o.note}</span>}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2"
                    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={on ? "" : "invisible"}>
                    <path d="M2.5 7.5 5.5 10.5 11.5 4" />
                  </svg>
                </button>
                {onRemove && o.removable && (
                  <button type="button" aria-label={`Delete ${o.label}`} onClick={() => setRemoving(o.value)}
                    className="mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition hover:text-red-500">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v6m4-6v6" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
