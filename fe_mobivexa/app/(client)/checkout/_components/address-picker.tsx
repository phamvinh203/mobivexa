'use client'

import { useState } from 'react'
import { Check, MapPin, Plus, X } from 'lucide-react'
import { AddressForm, formatAddress } from '@/components/address/address-form'
import { userApi } from '@/features/users/api'
import type { Address } from '@/features/users/types'

interface AddressPickerProps {
  addresses: Address[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** Gọi sau khi tạo địa chỉ mới — cha thêm vào danh sách và chọn luôn */
  onCreated: (address: Address) => void
}

export function AddressPicker({
  addresses,
  selectedId,
  onSelect,
  onCreated,
}: AddressPickerProps) {
  // Chưa có địa chỉ nào thì mở sẵn form — nếu không người dùng sẽ kẹt tại
  // bước này vì không đặt hàng được khi thiếu địa chỉ.
  const [adding, setAdding] = useState(addresses.length === 0)

  return (
    <section className="rounded-2xl border border-border bg-white p-5">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-bold text-gray-900">
          <MapPin className="h-4 w-4 text-[var(--color-primary)]" aria-hidden />
          Địa chỉ giao hàng
        </h2>
        {addresses.length > 0 && (
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            {adding ? (
              <>
                <X className="h-3.5 w-3.5" aria-hidden />
                Huỷ
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Thêm địa chỉ
              </>
            )}
          </button>
        )}
      </header>

      {addresses.length > 0 && (
        <ul className="flex flex-col gap-2">
          {addresses.map((address) => {
            const selected = address.id === selectedId
            return (
              <li key={address.id}>
                <button
                  type="button"
                  onClick={() => onSelect(address.id)}
                  aria-pressed={selected}
                  className={`flex w-full gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                    selected
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]'
                      : 'border-border hover:border-[var(--color-primary)]/50'
                  }`}
                >
                  <span
                    aria-hidden
                    className={`mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded-full border-2 ${
                      selected
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]'
                        : 'border-gray-300'
                    }`}
                  >
                    {selected && <Check className="h-2.5 w-2.5 text-white" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-900">
                        {address.fullName}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {address.phone}
                      </span>
                      {address.isDefault && (
                        <span className="rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--color-primary)]">
                          Mặc định
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-sm text-gray-600">
                      {formatAddress(address)}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {adding && (
        <div className={addresses.length > 0 ? 'mt-4 border-t border-border pt-4' : ''}>
          {addresses.length === 0 && (
            <p className="mb-3 text-sm text-muted-foreground">
              Bạn chưa có địa chỉ nào. Thêm địa chỉ nhận hàng để tiếp tục.
            </p>
          )}
          <AddressForm
            hideDefaultToggle={addresses.length === 0}
            onSubmit={async (payload) => {
              const created = await userApi.createAddress(payload)
              setAdding(false)
              onCreated(created)
            }}
            onCancel={addresses.length > 0 ? () => setAdding(false) : undefined}
          />
        </div>
      )}
    </section>
  )
}
