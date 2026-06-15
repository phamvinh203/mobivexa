"use client";

import { useMemo, useRef, useState } from "react";
import { X, Plus, Search } from "lucide-react";
import type { Tag } from "@/features/tags/types";
import { useClickOutside } from "@/lib/hooks/use-click-outside";

export function TagPicker({
  allTags,
  selectedIds,
  onToggle,
}: {
  allTags: Tag[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => { setOpen(false); setSearch(""); }, open);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const searchLower = search.toLowerCase();

  const selectedTags = useMemo(
    () => allTags.filter((t) => selectedSet.has(t.id)),
    [allTags, selectedSet],
  );
  const availableTags = useMemo(
    () => allTags.filter((t) => !selectedSet.has(t.id) && t.name.toLowerCase().includes(searchLower)),
    [allTags, selectedSet, searchLower],
  );

  return (
    <div ref={containerRef} className="relative">
      {/* Selected chips + trigger */}
      <div className="flex flex-wrap items-center gap-1.5">
        {selectedTags.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/8 px-2.5 py-0.5 text-xs font-medium text-[var(--color-primary)]"
          >
            {t.name}
            <button
              type="button"
              onClick={() => onToggle(t.id)}
              className="ml-0.5 rounded-full text-[var(--color-primary)]/60 transition-colors hover:text-[var(--color-primary)]"
              aria-label={`Xoá tag ${t.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2.5 py-0.5 text-xs text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-600"
        >
          <Plus className="h-3 w-3" />
          Thêm tag...
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-border bg-white shadow-lg ring-1 ring-black/5">
          <div className="border-b border-border px-3 py-2">
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm tag..."
                className="w-full bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
              />
            </div>
          </div>

          <ul className="max-h-48 overflow-y-auto py-1">
            {availableTags.length === 0 ? (
              <li className="px-3 py-2 text-xs text-gray-400">
                {search ? "Không tìm thấy tag" : "Đã chọn tất cả tags"}
              </li>
            ) : (
              availableTags.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onToggle(t.id);
                      setSearch("");
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    {t.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
