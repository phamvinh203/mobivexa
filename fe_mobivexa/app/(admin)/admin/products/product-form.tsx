'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Upload, X, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FilterChip } from '@/components/ui/filter-chip'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api/http'
import { assertImageFiles } from '@/lib/utils/file'
import { adminProductApi } from '@/features/products/api'
import type { Product, ProductImage, ProductPayload } from '@/features/products/types'
import { categoryApi } from '@/features/categories/api'
import { brandApi } from '@/features/brands/api'
import { tagApi } from '@/features/tags/api'
import type { Category } from '@/features/categories/types'
import type { Brand } from '@/features/brands/types'
import type { Tag } from '@/features/tags/types'
import { CreateVariantsEditor, type DraftVariant } from './create-variants-editor'
import { EditVariantsEditor } from './edit-variants-editor'

interface ProductFormProps {
  mode: 'create' | 'edit'
  product?: Product
  onDone: () => void
}

interface PickedImage {
  file: File
  url: string
}

export function ProductForm({ mode, product, onDone }: ProductFormProps) {
  const isEdit = mode === 'edit'

  const [name, setName] = useState(product?.name ?? '')
  const [slug, setSlug] = useState(product?.slug ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? '')
  const [brandId, setBrandId] = useState(product?.brandId ?? '')
  const [isActive, setIsActive] = useState(product?.isActive ?? true)
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured ?? false)

  const [tagIds, setTagIds] = useState<string[]>(product?.tags?.map((t) => t.id) ?? [])
  const [draftVariants, setDraftVariants] = useState<DraftVariant[]>([])

  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [tags, setTags] = useState<Tag[]>([])

  // Ảnh mới chọn (chưa upload) — 1 array gộp file + preview URL.
  const [newImages, setNewImages] = useState<PickedImage[]>([])
  const newImagesRef = useRef(newImages)

  // Ảnh hiện có (edit mode) — đồng bộ qua removeImage/setCover.
  const [images, setImages] = useState<ProductImage[]>(product?.images ?? [])
  const [busyImageId, setBusyImageId] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Tải categories/brands/tags cho dropdown + tag picker.
  useEffect(() => {
    Promise.all([categoryApi.list(), brandApi.list(), tagApi.list()])
      .then(([cats, brs, tgs]) => {
        setCategories(cats)
        setBrands(brs)
        setTags(tgs)
      })
      .catch(() => setError('Không tải được dữ liệu danh mục/thương hiệu/tag'))
  }, [])

  // Cleanup object URL khi unmount.
  useEffect(() => {
    newImagesRef.current = newImages
  }, [newImages])

  useEffect(() => {
    return () => newImagesRef.current.forEach((i) => URL.revokeObjectURL(i.url))
  }, [])

  function handlePickImages(files: FileList | null) {
    if (!files || files.length === 0) return
    const list = Array.from(files)
    try {
      assertImageFiles(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ảnh không hợp lệ')
      return
    }
    setError('')
    setNewImages((prev) => [...prev, ...list.map((file) => ({ file, url: URL.createObjectURL(file) }))])
  }

  function removeNewImage(item: PickedImage) {
    URL.revokeObjectURL(item.url)
    setNewImages((prev) => prev.filter((i) => i.url !== item.url))
  }

  function toggleTag(id: string) {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
  }

  async function runImageBusy(imageId: string, op: () => Promise<void>, errMsg: string) {
    setBusyImageId(imageId)
    try {
      await op()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : errMsg)
    } finally {
      setBusyImageId(null)
    }
  }

  async function handleRemoveExistingImage(img: ProductImage) {
    if (!product) return
    if (!confirm('Xoá ảnh này?')) return
    await runImageBusy(img.id, async () => {
      await adminProductApi.removeImage(product.id, img.id)
      setImages((prev) => prev.filter((i) => i.id !== img.id))
    }, 'Xoá ảnh thất bại')
  }

  async function handleSetCover(img: ProductImage) {
    if (!product || img.isCover) return
    await runImageBusy(img.id, async () => {
      await adminProductApi.setCover(product.id, img.id)
      setImages((prev) => prev.map((i) => ({ ...i, isCover: i.id === img.id })))
    }, 'Đặt ảnh bìa thất bại')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (name.trim().length < 2) return setError('Tên sản phẩm phải có ít nhất 2 ký tự')
    if (!categoryId) return setError('Vui lòng chọn danh mục')
    if (!brandId) return setError('Vui lòng chọn thương hiệu')

    const base: ProductPayload = {
      name: name.trim(),
      description: description.trim() || undefined,
      categoryId,
      brandId,
      tagIds,
      isActive,
      isFeatured,
    }
    const files = newImages.map((i) => i.file)

    setSubmitting(true)
    try {
      if (isEdit && product) {
        await adminProductApi.update(product.id, { ...base, slug: slug.trim() || undefined }, files)
      } else {
        // create: variants bắt buộc — lọc draft hợp lệ (có sku)
        const variants = draftVariants
          .filter((d) => d.sku.trim())
          .map((d) => ({
            sku: d.sku.trim(),
            color: d.color,
            storage: d.storage,
            ram: d.ram,
            originalPrice: d.originalPrice,
            salePrice: d.salePrice,
            stock: d.stock,
          }))
        if (variants.length === 0) {
          setError('Sản phẩm phải có ít nhất một biến thể (cần nhập SKU)')
          setSubmitting(false)
          return
        }
        await adminProductApi.create({ ...base, slug: slug.trim() || undefined, variants }, files)
      }
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Lưu sản phẩm thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>
      )}

      {/* Thông tin cơ bản */}
      <section className="space-y-4 rounded-xl bg-white p-5 ring-1 ring-border">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Thông tin</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Tên sản phẩm <span className="text-[var(--color-danger)]">*</span></Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="iPhone 15 Pro Max" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug (tuỳ chọn)</Label>
            <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="iphone-15-pro-max" />
            <p className="text-xs text-muted-foreground">Để trống sẽ tự tạo từ tên.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">Danh mục <span className="text-[var(--color-danger)]">*</span></Label>
            <select
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">— Chọn danh mục —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand">Thương hiệu <span className="text-[var(--color-danger)]">*</span></Label>
            <select
              id="brand"
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">— Chọn thương hiệu —</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Mô tả</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mô tả sản phẩm..."
            rows={4}
          />
        </div>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
            Đang bán
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
            Nổi bật
          </label>
        </div>
      </section>

      {/* Tags */}
      {tags.length > 0 && (
        <section className="space-y-3 rounded-xl bg-white p-5 ring-1 ring-border">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <FilterChip key={t.id} active={tagIds.includes(t.id)} label={t.name} onClick={() => toggleTag(t.id)} />
            ))}
          </div>
        </section>
      )}

      {/* Ảnh */}
      <section className="space-y-3 rounded-xl bg-white p-5 ring-1 ring-border">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Ảnh sản phẩm</h2>
        <div className="flex flex-wrap gap-3">
          {/* Ảnh hiện có (edit) */}
          {isEdit && images.map((img) => (
            <Thumb
              key={img.id}
              src={img.url}
              isCover={img.isCover}
              busy={busyImageId === img.id}
              onRemove={() => handleRemoveExistingImage(img)}
              onSetCover={!img.isCover ? () => handleSetCover(img) : undefined}
            />
          ))}
          {/* Ảnh mới (chưa upload) — ảnh đầu là bìa khi create */}
          {newImages.map((item, idx) => (
            <Thumb
              key={item.url}
              src={item.url}
              isCover={!isEdit && idx === 0}
              onRemove={() => removeNewImage(item)}
            />
          ))}
          {/* Picker */}
          <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border bg-muted/30 text-xs text-muted-foreground transition-colors hover:bg-muted/60">
            <Upload className="h-5 w-5" />
            <span>Thêm ảnh</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handlePickImages(e.target.files)} />
          </label>
        </div>
        {!isEdit && <p className="text-xs text-muted-foreground">Ảnh đầu tiên là ảnh bìa. Tối đa 10 ảnh, mỗi ảnh ≤ 5MB.</p>}
      </section>

      {/* Biến thể */}
      <section className="space-y-3 rounded-xl bg-white p-5 ring-1 ring-border">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Biến thể</h2>
        {isEdit && product ? (
          <EditVariantsEditor productId={product.id} existingVariants={product.variants} onError={setError} />
        ) : (
          <CreateVariantsEditor onChange={setDraftVariants} />
        )}
      </section>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="lg" onClick={onDone}>
          Huỷ
        </Button>
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo sản phẩm'}
        </Button>
      </div>
    </form>
  )
}

// ─── Image thumbnail dùng chung (ảnh hiện có + ảnh mới) ───────────────────────

function Thumb({
  src,
  isCover,
  busy,
  onRemove,
  onSetCover,
}: {
  src: string
  isCover: boolean
  busy?: boolean
  onRemove: () => void
  onSetCover?: () => void
}) {
  return (
    <div className="relative h-24 w-24 overflow-hidden rounded-md bg-gray-100 ring-1 ring-border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" />
      {isCover && (
        <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-black/60 px-1 py-0.5 text-xs text-white">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> Bìa
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 px-1 py-0.5">
        {onSetCover ? (
          <button type="button" disabled={busy} onClick={onSetCover} className="text-xs text-white disabled:opacity-30" title="Đặt làm bìa">
            <Star className="h-3.5 w-3.5" />
          </button>
        ) : <span />}
        <button type="button" disabled={busy} onClick={onRemove} className="text-xs text-white disabled:opacity-30" title="Xoá ảnh">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
