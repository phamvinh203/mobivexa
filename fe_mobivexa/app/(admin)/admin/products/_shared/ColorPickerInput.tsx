"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { resolveColor, COLOR_PRESETS } from "@/lib/utils/color";
import { useClickOutside } from "@/lib/hooks/use-click-outside";

export function ColorPickerInput({
  value,
  onChange,
  disabled,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  onBlur?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dotColor = resolveColor(value || null);

  useClickOutside(containerRef, () => setOpen(false), open);

  return (
    <div ref={containerRef} className="relative min-w-[100px]">
      <span
        className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full ring-1 ring-black/10"
        style={{ backgroundColor: dotColor }}
      />
      <Input
        value={value}
        disabled={disabled}
        placeholder="màu sắc"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        className="h-8 pl-7 text-sm"
      />

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-44 rounded-xl border border-border bg-white py-1.5 shadow-lg">
          <div className="grid grid-cols-2 gap-0.5 px-1.5">
            {COLOR_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(p.name);
                  setOpen(false);
                }}
                className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] text-gray-700 transition-colors hover:bg-gray-50 ${
                  value.toLowerCase() === p.name.toLowerCase()
                    ? "bg-gray-100 font-semibold text-gray-900"
                    : ""
                }`}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: p.hex }}
                />
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
