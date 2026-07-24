'use client'

import { useState, type ReactNode } from 'react'

export interface TabItem {
  id: string
  label: string
  /** Số phụ hiển thị cạnh nhãn (vd: số lượng đánh giá) */
  count?: number
  content: ReactNode
}

/**
 * Tabs Mô tả / Thông số / Đánh giá.
 * Nội dung từng tab do Server Component dựng sẵn rồi truyền vào qua props —
 * component này chỉ giữ state tab đang mở.
 */
export function ProductTabs({ tabs }: { tabs: TabItem[] }) {
  const [active, setActive] = useState(tabs[0]?.id)

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white">
      <div role="tablist" className="flex overflow-x-auto border-b border-border">
        {tabs.map((tab) => {
          const selected = tab.id === active
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setActive(tab.id)}
              className={`relative whitespace-nowrap px-5 py-3.5 text-sm font-semibold transition-colors ${
                selected
                  ? 'text-[var(--color-primary)]'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  ({tab.count})
                </span>
              )}
              {selected && (
                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[var(--color-primary)]" />
              )}
            </button>
          )
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={tab.id !== active}
          className="p-5 sm:p-6"
        >
          {tab.content}
        </div>
      ))}
    </div>
  )
}
