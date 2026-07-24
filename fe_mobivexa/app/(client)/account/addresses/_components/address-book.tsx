'use client'

import { useEffect, useState } from 'react'
import { Loader2, MapPin, Pencil, Plus, Star, Trash2, TriangleAlert } from 'lucide-react'
import { AddressForm, formatAddress } from '@/components/address/address-form'
import { userApi } from '@/features/users/api'
import { ApiError } from '@/lib/api/http'
import type { Address } from '@/features/users/types'

type Mode = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; address: Address }

export function AddressBook() {
  const [addresses, setAddresses] = useState<Address[] | null>(null)
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [error, setError] = useState<string | null>(null)
  /** id của địa chỉ đang chạy thao tác (xoá / đặt mặc định) */
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    userApi
      .listAddresses()
      .then((list) => {
        if (!cancelled) setAddresses(list)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setAddresses([])
        setError(
          err instanceof ApiError ? err.message : 'Không tải được danh sách địa chỉ',
        )
      })
    return () => {
      cancelled = true
    }
  }, [])

  /** Backend có thể đổi cả địa chỉ khác (unset mặc định cũ, tự set mặc định mới
   *  khi xoá) → nạp lại cả danh sách thay vì sửa cục bộ cho chắc. */
  async function reload() {
    setAddresses(await userApi.listAddresses())
  }

  async function run(id: string, action: () => Promise<void>) {
    setPendingId(id)
    setError(null)
    try {
      await action()
      await reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Thao tác không thành công')
    } finally {
      setPendingId(null)
    }
  }

  if (addresses === null) {
    return (
      <div className="grid min-h-[30vh] place-items-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        <p className="text-sm">Đang tải địa chỉ...</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-white p-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Địa chỉ của tôi</h1>
        {mode.kind === 'list' && (
          <button
            type="button"
            onClick={() => setMode({ kind: 'create' })}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-light)]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Thêm địa chỉ
          </button>
        )}
      </header>

      {error && (
        <p
          role="alert"
          className="mb-4 flex items-start gap-1.5 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-[var(--color-danger)]"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {mode.kind === 'create' && (
        <section className="mb-5 rounded-xl border border-border p-4">
          <h2 className="mb-3 font-semibold">Thêm địa chỉ mới</h2>
          <AddressForm
            hideDefaultToggle={addresses.length === 0}
            onSubmit={async (payload) => {
              await userApi.createAddress(payload)
              await reload()
              setMode({ kind: 'list' })
            }}
            onCancel={() => setMode({ kind: 'list' })}
          />
        </section>
      )}

      {mode.kind === 'edit' && (
        <section className="mb-5 rounded-xl border border-border p-4">
          <h2 className="mb-3 font-semibold">Sửa địa chỉ</h2>
          <AddressForm
            initial={mode.address}
            submitLabel="Cập nhật"
            onSubmit={async (payload) => {
              await userApi.updateAddress(mode.address.id, payload)
              await reload()
              setMode({ kind: 'list' })
            }}
            onCancel={() => setMode({ kind: 'list' })}
          />
        </section>
      )}

      {addresses.length === 0 && mode.kind === 'list' ? (
        <div className="grid place-items-center gap-2 py-12 text-center">
          <MapPin className="h-9 w-9 text-muted-foreground" aria-hidden />
          <p className="font-medium text-gray-700">Chưa có địa chỉ nào</p>
          <p className="text-sm text-muted-foreground">
            Thêm địa chỉ để thanh toán nhanh hơn ở lần mua sau.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {addresses.map((address) => {
            const busy = pendingId === address.id
            return (
              <li
                key={address.id}
                className={`rounded-xl border p-4 ${
                  address.isDefault
                    ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary-light)]/40'
                    : 'border-border'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-900">
                        {address.fullName}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {address.phone}
                      </span>
                      {address.isDefault && (
                        <span className="rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                          Mặc định
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      {formatAddress(address)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    {!address.isDefault && (
                      <button
                        type="button"
                        onClick={() =>
                          void run(address.id, () =>
                            userApi.setDefaultAddress(address.id).then(() => undefined),
                          )
                        }
                        disabled={busy}
                        title="Đặt làm mặc định"
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-40"
                      >
                        <Star className="h-3.5 w-3.5" aria-hidden />
                        Đặt mặc định
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setMode({ kind: 'edit', address })}
                      disabled={busy}
                      aria-label={`Sửa địa chỉ của ${address.fullName}`}
                      className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-40"
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void run(address.id, () =>
                          userApi.deleteAddress(address.id).then(() => undefined),
                        )
                      }
                      disabled={busy}
                      aria-label={`Xoá địa chỉ của ${address.fullName}`}
                      className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-[var(--color-danger)] disabled:opacity-40"
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Trash2 className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {addresses.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          Xoá địa chỉ mặc định thì địa chỉ mới nhất còn lại sẽ tự thành mặc định.
        </p>
      )}
    </div>
  )
}
