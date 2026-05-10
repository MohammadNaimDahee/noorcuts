"use client";

import { useState, useRef, useEffect, useMemo } from "react";

interface SearchSelectOption {
  value: string;
  label: string;
}

interface SearchSelectProps {
  options: SearchSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchSelect({ options, value, onChange, placeholder = "Search..." }: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen(!open); setQuery(""); }}
        className="studio-select flex w-full items-center justify-between text-left"
      >
        <span className="truncate">{selected?.label || "Select..."}</span>
        <svg className="h-3 w-3 shrink-0 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-[#2a2a4a] bg-[#0f0f20] shadow-xl shadow-black/40">
          {/* Search input */}
          <div className="border-b border-[#2a2a4a] p-1.5">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-md bg-[#1a1a30] px-2.5 py-1.5 text-[11px] text-zinc-200 placeholder:text-zinc-600 outline-none"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOpen(false);
                  setQuery("");
                } else if (e.key === "Enter" && filtered.length === 1) {
                  onChange(filtered[0].value);
                  setOpen(false);
                  setQuery("");
                }
              }}
            />
          </div>

          {/* Options list */}
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-[10px] text-zinc-600">No results</div>
            )}
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  setQuery("");
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] transition-colors ${
                  o.value === value
                    ? "bg-emerald-600/15 text-emerald-400"
                    : "text-zinc-300 hover:bg-[#1a1a30]"
                }`}
              >
                {o.value === value && (
                  <span className="text-emerald-400 text-[9px]">✓</span>
                )}
                <span className={o.value === value ? "" : "ml-[17px]"}>{o.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
