"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api/http";
import { assertImageFiles } from "@/lib/utils/file";
import { adminProductApi } from "@/features/products/api";
import type { Product, ProductImage, ProductPayload } from "@/features/products/types";
import { categoryApi } from "@/features/categories/api";
import { brandApi } from "@/features/brands/api";
import { tagApi } from "@/features/tags/api";
import type { Category } from "@/features/categories/types";
import type { Brand } from "@/features/brands/types";
import type { Tag } from "@/features/tags/types";
import { CreateVariantsEditor, type DraftVariant } from "./create-variants-editor";
import { EditVariantsEditor } from "./edit-variants-editor";
import { CreateSeoMetaEditor } from "./create-seo-meta-editor";
import { EditSeoMetaEditor } from "./edit-seo-meta-editor";
import { SectionCard } from "./_shared";
import {
  ProductBasicInfoSection,
  ProductImagesSection,
  type PickedImage,
  ProductPublishCard,
  ProductClassificationCard,
} from "./_sections";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductFormProps {
  mode: "create" | "edit";
  product?: Product;
  onDone: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

  // ─── Effects ──────────────────────────────────────────────────────────────

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

  // ─── Image handlers ───────────────────────────────────────────────────────

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
    await runImageBusy(img.id, async () => {
      await adminProductApi.removeImage(product.id, img.id);
      setImages((prev) => prev.filter((i) => i.id !== img.id));
    }, "Xoá ảnh thất bại");
  }

  async function handleSetCover(img: ProductImage) {
    if (!product || img.isCover) return;
    await runImageBusy(img.id, async () => {
      await adminProductApi.setCover(product.id, img.id);
      setImages((prev) =>
        prev.map((i) => ({ ...i, isCover: i.id === img.id })),
      );
    }, "Đặt ảnh bìa thất bại");
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

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

    const activeValue = overrideActive !== undefined ? overrideActive : isActive;
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

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left column ── */}
        <div className="space-y-6 lg:col-span-2">
          <ProductBasicInfoSection
            name={name}
            onNameChange={setName}
            slug={slug}
            onSlugChange={setSlug}
            onRegenerateSlug={() => setSlug(buildSlug(name))}
            shortDescription={shortDescription}
            onShortDescriptionChange={setShortDescription}
            initialDescription={product?.description ?? undefined}
            onDescriptionChange={setDescription}
          />

          <ProductImagesSection
            isEdit={isEdit}
            existingImages={images}
            newImages={newImages}
            busyImageId={busyImageId}
            onPickImages={handlePickImages}
            onRemoveExisting={handleRemoveExistingImage}
            onSetCover={handleSetCover}
            onRemoveNew={removeNewImage}
          />

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

        {/* ── Right sidebar ── */}
        <div className="space-y-6">
          <ProductPublishCard
            isEdit={isEdit}
            isActive={isActive}
            onIsActiveChange={setIsActive}
            isFeatured={isFeatured}
            onIsFeaturedChange={setIsFeatured}
            createdAt={product?.createdAt}
            submitting={submitting}
            onSaveDraft={() => doSubmit(false)}
            onPublish={() => doSubmit(true)}
          />

          <ProductClassificationCard
            categories={categories}
            categoryId={categoryId}
            onCategoryChange={setCategoryId}
            brands={brands}
            brandId={brandId}
            onBrandChange={setBrandId}
            tags={tags}
            tagIds={tagIds}
            onToggleTag={(id) =>
              setTagIds((prev) =>
                prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
              )
            }
          />

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
