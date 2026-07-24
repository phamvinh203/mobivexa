'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Clock, Loader2, Search, TrendingUp, X } from 'lucide-react'
import { productApi } from '@/features/products/api'
import { coverImageUrl } from '@/features/products/utils'
import { formatVND } from '@/lib/utils/format'
import { useClickOutside } from '@/lib/hooks/use-click-outside'
import type { Product } from '@/features/products/types'

/** Backend chỉ prefix-match từ CUỐI (toTsQuery gắn ":*"), 1 ký tự thì kết quả
 *  quá rộng và vô nghĩa → chờ đủ 2 ký tự mới gọi API. */
const MIN_CHARS = 2
const DEBOUNCE_MS = 300
const MAX_SUGGESTIONS = 6
const MAX_RECENT = 6
const RECENT_KEY = 'mobivexa:recent-searches'

function readRecent(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === 'string').slice(0, MAX_RECENT)
      : []
  } catch {
    // localStorage bị chặn (private mode) hoặc dữ liệu hỏng — coi như chưa có
    return []
  }
}

function writeRecent(terms: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(terms.slice(0, MAX_RECENT)))
  } catch {
    /* không lưu được thì thôi, không ảnh hưởng tìm kiếm */
  }
}

interface SearchBoxProps {
  /** Từ khoá gợi ý khi ô còn trống — truyền tên thương hiệu thật từ server */
  trending?: string[]
}

export function SearchBox({ trending = [] }: SearchBoxProps) {
  const router = useRouter()
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [recent, setRecent] = useState<string[]>([])
  const [highlight, setHighlight] = useState(-1)

  // Gom kết quả vào 1 state kèm chính từ khoá đã tạo ra nó. Nhờ vậy "đang tải"
  // là giá trị suy ra (term !== search.term) chứ không phải state riêng phải
  // đồng bộ tay — và không bao giờ hiện kết quả của từ khoá cũ.
  const [search, setSearch] = useState<{
    term: string
    products: Product[]
    total: number
    failed: boolean
  }>({ term: '', products: [], total: 0, failed: false })

  // Bỏ qua response về muộn hơn request mới hơn (race khi gõ nhanh).
  const requestSeq = useRef(0)

  useClickOutside(rootRef, () => setOpen(false), open)

  const term = query.trim()
  const showResults = term.length >= MIN_CHARS
  const busy = showResults && search.term !== term

  useEffect(() => {
    if (!showResults) return

    const seq = ++requestSeq.current
    const timer = setTimeout(() => {
      productApi
        .listPaged({ search: term, limit: MAX_SUGGESTIONS })
        .then((res) => {
          if (seq !== requestSeq.current) return
          setSearch({
            term,
            products: res.products ?? [],
            total: res.pagination?.total ?? 0,
            failed: false,
          })
        })
        .catch(() => {
          if (seq !== requestSeq.current) return
          setSearch({ term, products: [], total: 0, failed: true })
        })
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [term, showResults])

  const results = showResults && !busy ? search.products : []
  const total = showResults && !busy ? search.total : 0

  /** Mở panel + nạp lịch sử tìm. Đọc localStorage trong event handler (không
   *  phải effect) nên tránh được cascading render lẫn lệch hydrate SSR. */
  function openPanel() {
    setRecent(readRecent())
    setOpen(true)
  }

  // Danh sách item điều hướng được bằng bàn phím (đúng thứ tự hiển thị)
  const options: { key: string; href: string; term?: string }[] = showResults
    ? [
        ...results.map((p) => ({ key: p.id, href: `/products/${p.slug}` })),
        ...(total > 0
          ? [
              {
                key: '__all__',
                href: `/products?search=${encodeURIComponent(term)}`,
                term,
              },
            ]
          : []),
      ]
    : [...recent, ...trending].map((t) => ({
        key: `t-${t}`,
        href: `/products?search=${encodeURIComponent(t)}`,
        term: t,
      }))

  const saveTerm = useCallback((value: string) => {
    const clean = value.trim()
    if (!clean) return
    setRecent((prev) => {
      const next = [clean, ...prev.filter((t) => t !== clean)].slice(0, MAX_RECENT)
      writeRecent(next)
      return next
    })
  }, [])

  function go(href: string, termToSave?: string) {
    if (termToSave) saveTerm(termToSave)
    setOpen(false)
    setHighlight(-1)
    inputRef.current?.blur()
    router.push(href)
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const picked = highlight >= 0 ? options[highlight] : undefined
    if (picked) {
      go(picked.href, picked.term)
      return
    }
    if (!term) {
      router.push('/products')
      setOpen(false)
      return
    }
    go(`/products?search=${encodeURIComponent(term)}`, term)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
      setHighlight(-1)
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (options.length === 0) return
      e.preventDefault()
      setOpen(true)
      setHighlight((i) => {
        const next = e.key === 'ArrowDown' ? i + 1 : i - 1
        // Cuộn vòng để giữ được cảm giác list liên tục
        if (next >= options.length) return 0
        if (next < 0) return options.length - 1
        return next
      })
    }
  }

  function clearRecent() {
    setRecent([])
    writeRecent([])
  }

  const hasPanel =
    open && (showResults || recent.length > 0 || trending.length > 0)

  return (
    <div ref={rootRef} className="relative mx-auto max-w-[560px] flex-1">
      <form onSubmit={onSubmit} role="search">
        <label htmlFor="navbar-search" className="sr-only">
          Tìm kiếm sản phẩm
        </label>
        <div className="relative">
          <input
            ref={inputRef}
            id="navbar-search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setHighlight(-1)
              setOpen(true)
            }}
            onFocus={openPanel}
            onKeyDown={onKeyDown}
            type="search"
            autoComplete="off"
            role="combobox"
            aria-expanded={hasPanel}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              highlight >= 0 ? `${listboxId}-opt-${highlight}` : undefined
            }
            placeholder="Tìm iPhone, Galaxy, Xiaomi..."
            className="h-11 w-full rounded-full border border-[var(--color-border)] bg-gray-50 pl-11 pr-20 text-sm outline-none transition-colors focus:border-[var(--color-primary)] focus:bg-white"
          />
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
          <button
            type="submit"
            className="absolute right-1 top-1 h-9 rounded-full bg-[var(--color-primary)] px-4 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            Tìm
          </button>
        </div>
      </form>

      {hasPanel && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Gợi ý tìm kiếm"
          className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-white shadow-lg"
        >
          {showResults ? (
            <>
              {busy && (
                <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Đang tìm...
                </p>
              )}

              {!busy && search.failed && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Không tải được gợi ý. Nhấn Enter để tìm đầy đủ.
                </p>
              )}

              {!busy && !search.failed && results.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Không tìm thấy sản phẩm nào cho{' '}
                  <span className="font-medium text-gray-700">“{term}”</span>
                </p>
              )}

              {results.map((product, i) => {
                const cover = coverImageUrl(product)
                const variant = product.variants?.[0]
                return (
                  <button
                    key={product.id}
                    type="button"
                    id={`${listboxId}-opt-${i}`}
                    role="option"
                    aria-selected={highlight === i}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => go(`/products/${product.slug}`)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      highlight === i ? 'bg-[var(--color-primary-light)]' : ''
                    }`}
                  >
                    <span className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-white">
                      {cover ? (
                        <Image
                          src={cover}
                          alt=""
                          fill
                          sizes="44px"
                          className="object-contain p-1"
                        />
                      ) : (
                        <Search
                          className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-gray-300"
                          aria-hidden
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-800">
                        {product.name}
                      </span>
                      {variant && (
                        <span className="block text-xs font-semibold text-[var(--color-sale-strong)]">
                          {formatVND(variant.salePrice)}
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}

              {total > 0 && (
                <button
                  type="button"
                  id={`${listboxId}-opt-${results.length}`}
                  role="option"
                  aria-selected={highlight === results.length}
                  onMouseEnter={() => setHighlight(results.length)}
                  onClick={() =>
                    go(`/products?search=${encodeURIComponent(term)}`, term)
                  }
                  className={`block w-full border-t border-border px-4 py-2.5 text-center text-sm font-semibold text-[var(--color-primary)] transition-colors ${
                    highlight === results.length
                      ? 'bg-[var(--color-primary-light)]'
                      : ''
                  }`}
                >
                  Xem tất cả {total} kết quả
                </button>
              )}
            </>
          ) : (
            <>
              {recent.length > 0 && (
                <section className="py-2">
                  <header className="flex items-center justify-between px-4 pb-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      Tìm gần đây
                    </h3>
                    <button
                      type="button"
                      onClick={clearRecent}
                      className="text-xs text-muted-foreground hover:text-gray-800"
                    >
                      Xoá
                    </button>
                  </header>
                  {recent.map((item, i) => (
                    <button
                      key={item}
                      type="button"
                      id={`${listboxId}-opt-${i}`}
                      role="option"
                      aria-selected={highlight === i}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() =>
                        go(`/products?search=${encodeURIComponent(item)}`, item)
                      }
                      className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-gray-700 transition-colors ${
                        highlight === i ? 'bg-[var(--color-primary-light)]' : ''
                      }`}
                    >
                      <Clock
                        className="h-3.5 w-3.5 flex-shrink-0 text-gray-400"
                        aria-hidden
                      />
                      <span className="truncate">{item}</span>
                    </button>
                  ))}
                </section>
              )}

              {trending.length > 0 && (
                <section className="border-t border-border py-2 first:border-t-0">
                  <h3 className="px-4 pb-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">
                    <TrendingUp className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                    Thương hiệu phổ biến
                  </h3>
                  <div className="flex flex-wrap gap-1.5 px-4 pb-1">
                    {trending.map((item, i) => {
                      const index = recent.length + i
                      return (
                        <button
                          key={item}
                          type="button"
                          id={`${listboxId}-opt-${index}`}
                          role="option"
                          aria-selected={highlight === index}
                          onMouseEnter={() => setHighlight(index)}
                          onClick={() =>
                            go(`/products?search=${encodeURIComponent(item)}`, item)
                          }
                          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                            highlight === index
                              ? 'bg-[var(--color-primary)] text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {item}
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {/* Nút xoá nhanh nội dung đã gõ (ẩn nút clear mặc định của type=search) */}
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery('')
            setHighlight(-1)
            inputRef.current?.focus()
          }}
          aria-label="Xoá từ khoá"
          className="absolute right-[72px] top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  )
}
