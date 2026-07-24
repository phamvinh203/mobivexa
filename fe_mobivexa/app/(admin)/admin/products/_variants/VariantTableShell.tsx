import type { ReactNode } from "react";
import { VARIANT_HEADERS } from "./types";

export function VariantTableShell({
  children,
  minWidth = 580,
}: {
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-border bg-gray-50">
            {VARIANT_HEADERS.map((h, i) => (
              <th
                key={h}
                className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 ${i === 0 ? "w-12" : ""}`}
              >
                {h}
              </th>
            ))}
            {/* delete col */}
            <th className="w-8" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}
