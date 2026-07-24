'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ApiError } from '@/lib/api/http'
import type { Address, AddressPayload } from '@/features/users/types'

/** Khớp PHONE_RE trong be_mobivexa/src/validators/user.validator.ts */
const PHONE_RE = /^(0|\+84)[0-9]{8,10}$/

/** Địa chỉ hiển thị 1 dòng: "123 Lê Lợi, Bến Nghé, Quận 1, TP.HCM" */
export function formatAddress(address: Address): string {
  return [address.streetDetail, address.ward, address.district, address.province]
    .filter(Boolean)
    .join(', ')
}

const EMPTY: AddressPayload = {
  fullName: '',
  phone: '',
  province: '',
  district: '',
  ward: '',
  streetDetail: '',
}

/** Kiểm tra y hệt validateAddress bên backend — báo lỗi ngay, khỏi chờ round-trip. */
function validate(form: AddressPayload): string | null {
  if (form.fullName.trim().length < 2) {
    return 'Họ tên người nhận phải có ít nhất 2 ký tự'
  }
  if (!PHONE_RE.test(form.phone.trim())) {
    return 'Số điện thoại không hợp lệ (bắt đầu bằng 0 hoặc +84)'
  }
  if (
    !form.province.trim() ||
    !form.district.trim() ||
    !form.ward.trim() ||
    !form.streetDetail.trim()
  ) {
    return 'Vui lòng điền đầy đủ thông tin địa chỉ'
  }
  return null
}

interface AddressFormProps {
  /** Có giá trị = chế độ sửa. PUT bên backend cũng dùng validateAddress nên
   *  luôn phải gửi đủ field, không có cập nhật từng phần. */
  initial?: Address
  onSubmit: (payload: AddressPayload) => Promise<void>
  onCancel?: () => void
  submitLabel?: string
  /** Ẩn ô "đặt làm mặc định" (vd: địa chỉ đầu tiên backend tự set mặc định) */
  hideDefaultToggle?: boolean
}

export function AddressForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = 'Lưu địa chỉ',
  hideDefaultToggle = false,
}: AddressFormProps) {
  const [form, setForm] = useState<AddressPayload>(
    initial
      ? {
          fullName: initial.fullName,
          phone: initial.phone,
          province: initial.province,
          district: initial.district,
          ward: initial.ward,
          streetDetail: initial.streetDetail,
          isDefault: initial.isDefault,
        }
      : EMPTY,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function field<K extends keyof AddressPayload>(key: K, value: AddressPayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const invalid = validate(form)
    if (invalid) {
      setError(invalid)
      return
    }

    setError(null)
    setSaving(true)
    try {
      await onSubmit({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        province: form.province.trim(),
        district: form.district.trim(),
        ward: form.ward.trim(),
        streetDetail: form.streetDetail.trim(),
        ...(hideDefaultToggle ? {} : { isDefault: form.isDefault }),
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được địa chỉ')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-primary)]'

  const fields: {
    key: keyof AddressPayload
    label: string
    placeholder: string
    autoComplete?: string
    inputMode?: 'tel'
  }[] = [
    { key: 'fullName', label: 'Họ tên người nhận', placeholder: 'Nguyễn Văn A', autoComplete: 'name' },
    { key: 'phone', label: 'Số điện thoại', placeholder: '0912345678', autoComplete: 'tel', inputMode: 'tel' },
    { key: 'province', label: 'Tỉnh / Thành phố', placeholder: 'TP. Hồ Chí Minh' },
    { key: 'district', label: 'Quận / Huyện', placeholder: 'Quận 1' },
    { key: 'ward', label: 'Phường / Xã', placeholder: 'Phường Bến Nghé' },
    { key: 'streetDetail', label: 'Địa chỉ cụ thể', placeholder: '123 Lê Lợi', autoComplete: 'street-address' },
  ]

  return (
    <form onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(({ key, label, placeholder, autoComplete, inputMode }) => (
          <label key={key} className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">{label}</span>
            <input
              value={String(form[key] ?? '')}
              onChange={(e) => field(key, e.target.value as never)}
              className={inputClass}
              placeholder={placeholder}
              autoComplete={autoComplete}
              inputMode={inputMode}
            />
          </label>
        ))}
      </div>

      {!hideDefaultToggle && (
        <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={!!form.isDefault}
            onChange={(e) => field('isDefault', e.target.checked)}
            className="h-4 w-4 accent-[var(--color-primary)]"
          />
          Đặt làm địa chỉ mặc định
        </label>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Huỷ
          </button>
        )}
      </div>
    </form>
  )
}
