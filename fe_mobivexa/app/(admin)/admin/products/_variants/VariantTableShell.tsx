import type { ReactNode } from "react";

const HEADERS = [
  "ẢNH",
  "MÀU SẮC",
  "RAM",
  "DUNG LƯỢNG",
  "SKU",
  "GIÁ GỐC",
  "GIÁ BÁN",
  "TỒN KHO",
];

export function VariantTableShell({
  children,
  minWidth = "min-w-[580px]",
}: {
  children: ReactNode;
  /** Tailwind min-w class. Default min-w-[580px] */
  minWidth?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className={`w-full ${minWidth} text-sm`}>
        <thead>
          <tr className="border-b border-border bg-gray-50">
            {HEADERS.map((h, i) => (
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
