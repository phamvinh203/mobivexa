"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  X,
  Star,
  RefreshCw,
  ChevronDown,
  Camera,
  Search,
  Plus,
  Bold,
  Italic,
  Underline,
  List,
  Link as LinkIcon,
  Image as ImageIconRTE,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/http";
import { assertImageFiles } from "@/lib/utils/file";
import { adminProductApi } from "@/features/products/api";
import type {
  Product,
  ProductImage,
  ProductPayload,
} from "@/features/products/types";
import { categoryApi } from "@/features/categories/api";
import { brandApi } from "@/features/brands/api";
import { tagApi } from "@/features/tags/api";
import type { Category } from "@/features/categories/types";
import type { Brand } from "@/features/brands/types";
import type { Tag } from "@/features/tags/types";
import {
  CreateVariantsEditor,
  type DraftVariant,
} from "./create-variants-editor";
import { EditVariantsEditor } from "./edit-variants-editor";
import { CreateSeoMetaEditor } from "./create-seo-meta-editor";
import { EditSeoMetaEditor } from "./edit-seo-meta-editor";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProductFormProps {
  mode: "create" | "edit";
  product?: Product;
  onDone: () => void;
}

interface PickedImage {
  file: File;
  url: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// ─── ProductForm ──────────────────────────────────────────────────────────────

export function ProductForm({ mode, product, onDone }: ProductFormProps) {
  const isEdit = mode === "edit";

  // ── Core fields ──────────────────────────────────────────────────────────
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState(product?.description ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [brandId, setBrandId] = useState(product?.brandId ?? "");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured ?? false);
  const [tagIds, setTagIds] = useState<string[]>(
    product?.tags?.map((t) => t.id) ?? [],
  );
  const [draftVariants, setDraftVariants] = useState<DraftVariant[]>([]);

  // ── Remote data ───────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  // ── Images ────────────────────────────────────────────────────────────────
  const [newImages, setNewImages] = useState<PickedImage[]>([]);
  const newImagesRef = useRef(newImages);
  const [images, setImages] = useState<ProductImage[]>(product?.images ?? []);
  const [busyImageId, setBusyImageId] = useState<string | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // ── Rich-text editor ref (contentEditable) ────────────────────────────────
  const descRef = useRef<HTMLDivElement>(null);
  const descInitialized = useRef(false);

  // ─── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([categoryApi.list(), brandApi.list(), tagApi.list()])
      .then(([cats, brs, tgs]) => {
        setCategories(cats);
        setBrands(brs);
        setTags(tgs);
      })
      .catch(() => setError("Không tải được dữ liệu danh mục/thương hiệu/tag"));
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    newImagesRef.current = newImages;
  }, [newImages]);
  useEffect(
    () => () => newImagesRef.current.forEach((i) => URL.revokeObjectURL(i.url)),
    [],
  );

  useEffect(() => {
    if (descRef.current && !descInitialized.current && product?.description) {
      descRef.current.innerHTML = product.description;
      descInitialized.current = true;
    }
  }, [product?.description]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function regenerateSlug() {
    setSlug(buildSlug(name));
  }

  function handlePickImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    try {
      assertImageFiles(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ảnh không hợp lệ");
      return;
    }
    setError("");
    setNewImages((prev) => [
      ...prev,
      ...list.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
    ]);
  }

  function removeNewImage(item: PickedImage) {
    URL.revokeObjectURL(item.url);
    setNewImages((prev) => prev.filter((i) => i.url !== item.url));
  }

  function toggleTag(id: string) {
    setTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }

  async function runImageBusy(
    imageId: string,
    op: () => Promise<void>,
    errMsg: string,
  ) {
    setBusyImageId(imageId);
    try {
      await op();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : errMsg);
    } finally {
      setBusyImageId(null);
    }
  }

  async function handleRemoveExistingImage(img: ProductImage) {
    if (!product) return;
    if (!confirm("Xoá ảnh này?")) return;
    await runImageBusy(
      img.id,
      async () => {
        await adminProductApi.removeImage(product.id, img.id);
        setImages((prev) => prev.filter((i) => i.id !== img.id));
      },
      "Xoá ảnh thất bại",
    );
  }

  async function handleSetCover(img: ProductImage) {
    if (!product || img.isCover) return;
    await runImageBusy(
      img.id,
      async () => {
        await adminProductApi.setCover(product.id, img.id);
        setImages((prev) =>
          prev.map((i) => ({ ...i, isCover: i.id === img.id })),
        );
      },
      "Đặt ảnh bìa thất bại",
    );
  }

  function validate(): string | null {
    if (name.trim().length < 2) return "Tên sản phẩm phải có ít nhất 2 ký tự";
    if (!categoryId) return "Vui lòng chọn danh mục";
    if (!brandId) return "Vui lòng chọn thương hiệu";
    return null;
  }

  async function doSubmit(overrideActive?: boolean) {
    setError("");
    const validErr = validate();
    if (validErr) return setError(validErr);

    const activeValue =
      overrideActive !== undefined ? overrideActive : isActive;
    const base: ProductPayload = {
      name: name.trim(),
      description: description.trim() || undefined,
      categoryId,
      brandId,
      tagIds,
      isActive: activeValue,
      isFeatured,
    };
    const files = newImages.map((i) => i.file);

    setSubmitting(true);
    try {
      if (isEdit && product) {
        await adminProductApi.update(
          product.id,
          { ...base, slug: slug.trim() || undefined },
          files,
        );
      } else {
        const variants = draftVariants
          .filter((d) => d.sku.trim())
          .map((d) => ({
            sku: d.sku.trim(),
            color: d.color,
            storage: d.storage,
            ram: d.ram,
            imageUrl: d.imageUrl,
            originalPrice: d.originalPrice,
            salePrice: d.salePrice,
            stock: d.stock,
          }));
        if (variants.length === 0) {
          setError("Sản phẩm phải có ít nhất một biến thể (cần nhập SKU)");
          setSubmitting(false);
          return;
        }
        await adminProductApi.create(
          { ...base, slug: slug.trim() || undefined, variants },
          files,
        );
      }
      setSavedAt(new Date());
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Lưu sản phẩm thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    void doSubmit();
  }

  // ─── Derived ───────────────────────────────────────────────────────────────

  const totalImages = (isEdit ? images.length : 0) + newImages.length;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      {/* ── Error ─────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {/* ── Main grid ─────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ============= LEFT COLUMN ============= */}
        <div className="space-y-6 lg:col-span-2">
          {/* Thông tin cơ bản */}
          <SectionCard title="Thông tin cơ bản">
            {/* Tên sản phẩm */}
            <div className="space-y-1.5">
              <Label htmlFor="pf-name">
                Tên sản phẩm{" "}
                <span className="text-[var(--color-danger)]">*</span>
              </Label>
              <Input
                id="pf-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="tên sản phẩm"
              />
            </div>

            {/* Slug + regenerate */}
            <div className="space-y-1.5">
              <Label htmlFor="pf-slug">Slug (Đường dẫn tĩnh)</Label>
              <div className="flex gap-2">
                <Input
                  id="pf-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="đường dẫn tĩnh (nên để trống để tự tạo từ tên)"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={regenerateSlug}
                  title="Tạo slug từ tên"
                  className="shrink-0 h-9 w-9"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Mô tả ngắn */}
            <div className="space-y-1.5">
              <Label htmlFor="pf-short-desc">Mô tả ngắn</Label>
              <Textarea
                id="pf-short-desc"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Nhập mô tả ngắn gọn về sản phẩm..."
                rows={3}
              />
            </div>

            {/* Mô tả chi tiết — contentEditable với toolbar */}
            <div className="space-y-1.5">
              <Label>Mô tả chi tiết</Label>
              <div className="overflow-hidden rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-0.5 border-b border-input bg-gray-50/80 px-2 py-1.5">
                  {/* Format buttons */}
                  {(
                    [
                      { Icon: Bold, title: "Bold", cmd: "bold" },
                      { Icon: Italic, title: "Italic", cmd: "italic" },
                      { Icon: Underline, title: "Underline", cmd: "underline" },
                    ] as const
                  ).map(({ Icon, title, cmd }) => (
                    <button
                      key={cmd}
                      type="button"
                      title={title}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        document.execCommand(cmd);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded text-gray-600 transition-colors hover:bg-gray-200 active:bg-gray-300"
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  ))}

                  <div className="mx-1.5 h-4 w-px bg-gray-300" />

                  {/* Heading buttons */}
                  {(
                    [
                      { label: "H1", title: "Heading 1", arg: "H1" },
                      { label: "H2", title: "Heading 2", arg: "H2" },
                    ] as const
                  ).map(({ label, title, arg }) => (
                    <button
                      key={label}
                      type="button"
                      title={title}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        document.execCommand("formatBlock", false, arg);
                      }}
                      className="flex h-7 items-center justify-center rounded px-1.5 text-[11px] font-bold text-gray-600 transition-colors hover:bg-gray-200"
                    >
                      {label}
                    </button>
                  ))}

                  <div className="mx-1.5 h-4 w-px bg-gray-300" />

                  <button
                    type="button"
                    title="Danh sách"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      document.execCommand("insertUnorderedList");
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded text-gray-600 transition-colors hover:bg-gray-200"
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    title="Liên kết"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const url = prompt("Nhập URL liên kết:");
                      if (url) document.execCommand("createLink", false, url);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded text-gray-600 transition-colors hover:bg-gray-200"
                  >
                    <LinkIcon className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    title="Chèn ảnh"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const url = prompt("Nhập URL ảnh:");
                      if (url) document.execCommand("insertImage", false, url);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded text-gray-600 transition-colors hover:bg-gray-200"
                  >
                    <ImageIconRTE className="h-3.5 w-3.5" />
                  </button>

                  {/* Table placeholder button */}
                  <button
                    type="button"
                    title="Bảng (chưa hỗ trợ)"
                    className="flex h-7 w-7 items-center justify-center rounded text-gray-400 cursor-not-allowed"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <rect x="1" y="1" width="14" height="14" rx="1" />
                      <line x1="1" y1="5" x2="15" y2="5" />
                      <line x1="1" y1="9" x2="15" y2="9" />
                      <line x1="5" y1="1" x2="5" y2="15" />
                      <line x1="10" y1="1" x2="10" y2="15" />
                    </svg>
                  </button>
                </div>

                {/* ContentEditable area */}
                <div
                  ref={descRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => setDescription(e.currentTarget.innerHTML)}
                  data-placeholder="Nhập mô tả chi tiết về sản phẩm..."
                  className="prose prose-sm min-h-36 max-w-none p-3 text-sm text-gray-700 outline-none empty:before:text-gray-400 empty:before:content-[attr(data-placeholder)]"
                />
              </div>
            </div>
          </SectionCard>

          {/* Hình ảnh sản phẩm */}
          <SectionCard title="Hình ảnh sản phẩm">
            {totalImages > 0 && (
              <p className="text-xs text-gray-400">
                Hiển thị 1–{totalImages} / {totalImages} sản phẩm đang tạo
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              {/* Add image picker (leftmost) */}
              <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border bg-gray-50 text-xs text-gray-400 transition-colors hover:border-[var(--color-primary)]/50 hover:bg-gray-100">
                <Camera className="h-5 w-5" />
                <span>Thêm ảnh</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handlePickImages(e.target.files)}
                />
              </label>

              {/* Existing images (edit mode) */}
              {isEdit &&
                images.map((img) => (
                  <Thumb
                    key={img.id}
                    src={img.url}
                    isCover={img.isCover}
                    busy={busyImageId === img.id}
                    onRemove={() => handleRemoveExistingImage(img)}
                    onSetCover={
                      !img.isCover ? () => handleSetCover(img) : undefined
                    }
                  />
                ))}

              {/* Newly picked images */}
              {newImages.map((item, idx) => (
                <Thumb
                  key={item.url}
                  src={item.url}
                  isCover={!isEdit && idx === 0}
                  onRemove={() => removeNewImage(item)}
                />
              ))}
            </div>

            {!isEdit && (
              <p className="text-xs text-gray-400">
                Ảnh đầu tiên là ảnh bìa. Tối đa 10 ảnh, mỗi ảnh ≤ 5 MB.
              </p>
            )}
          </SectionCard>

          {/* Biến thể & Tồn kho */}
          <SectionCard title="Biến thể & Tồn kho">
            {isEdit && product ? (
              <EditVariantsEditor
                productId={product.id}
                existingVariants={product.variants}
                onError={setError}
                availableImages={images.map((i) => ({ url: i.url }))}
                productName={name}
              />
            ) : (
              <CreateVariantsEditor
                onChange={setDraftVariants}
                availableImages={newImages.map((i) => ({ url: i.url }))}
                productName={name}
              />
            )}
          </SectionCard>
        </div>

        {/* ============= RIGHT SIDEBAR ============= */}
        <div className="space-y-6">
          {/* XUẤT BẢN */}
          <SectionCard title="XUẤT BẢN">
            <div className="space-y-3">
              <Toggle
                label="Trạng thái"
                hint={isActive ? "Đang bán" : "Đã ẩn"}
                checked={isActive}
                onChange={setIsActive}
              />
              <Toggle
                label="Nổi bật"
                hint="Hiển thị ở trang chủ"
                checked={isFeatured}
                onChange={setIsFeatured}
              />

              <div className="flex items-center justify-between border-t border-border/60 pt-3 text-sm">
                <span className="text-gray-500">Ngày tạo</span>
                <span className="font-medium text-gray-700">
                  {isEdit && product
                    ? new Date(product.createdAt).toLocaleDateString("vi-VN")
                    : new Date().toLocaleDateString("vi-VN")}
                </span>
              </div>
            </div>

            <div className="border-t border-border/60 pt-4">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={submitting}
                  onClick={() => doSubmit(false)}
                >
                  Lưu nháp
                </Button>

                <Button
                  type="button"
                  size="lg"
                  disabled={submitting}
                  onClick={() => doSubmit(true)}
                >
                  {submitting
                    ? "Đang lưu..."
                    : isEdit
                      ? "Cập nhật"
                      : "Xuất bản ngay"}
                </Button>
              </div>
            </div>
          </SectionCard>

          {/* PHÂN LOẠI */}
          <SectionCard title="PHÂN LOẠI">
            <div className="space-y-4">
              {/* Danh mục */}
              <div className="space-y-1.5">
                <Label htmlFor="pf-category">
                  Danh mục <span className="text-[var(--color-danger)]">*</span>
                </Label>
                <div className="relative">
                  <select
                    id="pf-category"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="h-9 w-full appearance-none rounded-lg border border-input bg-transparent pl-2.5 pr-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="">— Chọn danh mục —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              {/* Thương hiệu */}
              <div className="space-y-1.5">
                <Label htmlFor="pf-brand">
                  Thương hiệu{" "}
                  <span className="text-[var(--color-danger)]">*</span>
                </Label>
                <div className="relative">
                  <select
                    id="pf-brand"
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    className="h-9 w-full appearance-none rounded-lg border border-input bg-transparent pl-2.5 pr-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="">— Chọn thương hiệu —</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-1.5">
                <Label>Tags</Label>
                <TagPicker
                  allTags={tags}
                  selectedIds={tagIds}
                  onToggle={toggleTag}
                />
              </div>
            </div>
          </SectionCard>

          {/* SEO & META */}
          {isEdit && product ? (
            <EditSeoMetaEditor
              initial={{ metaTitle: "", metaDescription: "" }}
              productName={product.name}
              productSlug={product.slug}
            />
          ) : (
            <CreateSeoMetaEditor productName={name} productSlug={slug} />
          )}
        </div>
      </div>
    </form>
  );
}

// ─── TagPicker ───────────────────────────────────────────────────────────────

function TagPicker({
  allTags,
  selectedIds,
  onToggle,
}: {
  allTags: import("@/features/tags/types").Tag[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const selectedTags = allTags.filter((t) => selectedIds.includes(t.id));
  const availableTags = allTags.filter(
    (t) =>
      !selectedIds.includes(t.id) &&
      t.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div ref={containerRef} className="relative">
      {/* Selected chips + "Thêm tag" trigger */}
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
          {/* Search */}
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

          {/* Tag list */}
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

// ─── SectionCard ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl bg-white p-5 ring-1 ring-border">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

// ─── Toggle ──────────────────────────────────────────────────────────────────

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm leading-tight">
        <span className="block font-medium text-gray-700">{label}</span>
        {hint && <span className="block text-xs text-gray-400">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
          checked ? "bg-[var(--color-primary)]" : "bg-gray-200"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

// ─── Thumb ───────────────────────────────────────────────────────────────────

function Thumb({
  src,
  isCover,
  busy,
  onRemove,
  onSetCover,
}: {
  src: string;
  isCover: boolean;
  busy?: boolean;
  onRemove: () => void;
  onSetCover?: () => void;
}) {
  return (
    <div className="group relative h-24 w-24 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" />

      {isCover && (
        <span className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
          <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
          Ảnh bìa
        </span>
      )}

      {/* Overlay actions */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1.5 pt-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        {onSetCover ? (
          <button
            type="button"
            disabled={busy}
            onClick={onSetCover}
            className="text-white/80 transition-colors hover:text-amber-400 disabled:opacity-30"
            title="Đặt làm ảnh bìa"
          >
            <Star className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          disabled={busy}
          onClick={onRemove}
          className="text-white/80 transition-colors hover:text-red-400 disabled:opacity-30"
          title="Xoá ảnh"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {busy && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
        </div>
      )}
    </div>
  );
}
