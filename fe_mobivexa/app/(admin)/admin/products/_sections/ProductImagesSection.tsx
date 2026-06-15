"use client";

import { Camera } from "lucide-react";
import type { ProductImage } from "@/features/products/types";
import { SectionCard, ImageThumb } from "../_shared";

export interface PickedImage {
  file: File;
  url: string;
}

interface ProductImagesSectionProps {
  isEdit: boolean;
  existingImages: ProductImage[];
  newImages: PickedImage[];
  busyImageId: string | null;
  onPickImages: (files: FileList | null) => void;
  onRemoveExisting: (img: ProductImage) => void;
  onSetCover: (img: ProductImage) => void;
  onRemoveNew: (item: PickedImage) => void;
}

export function ProductImagesSection({
  isEdit,
  existingImages,
  newImages,
  busyImageId,
  onPickImages,
  onRemoveExisting,
  onSetCover,
  onRemoveNew,
}: ProductImagesSectionProps) {
  const totalImages = (isEdit ? existingImages.length : 0) + newImages.length;

  return (
    <SectionCard title="Hình ảnh sản phẩm">
      {totalImages > 0 && (
        <p className="text-xs text-gray-400">
          Hiển thị 1–{totalImages} / {totalImages} sản phẩm đang tạo
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        {/* Picker trigger */}
        <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border bg-gray-50 text-xs text-gray-400 transition-colors hover:border-[var(--color-primary)]/50 hover:bg-gray-100">
          <Camera className="h-5 w-5" />
          <span>Thêm ảnh</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onPickImages(e.target.files)}
          />
        </label>

        {/* Existing images (edit mode) */}
        {isEdit &&
          existingImages.map((img) => (
            <ImageThumb
              key={img.id}
              src={img.url}
              isCover={img.isCover}
              busy={busyImageId === img.id}
              onRemove={() => onRemoveExisting(img)}
              onSetCover={!img.isCover ? () => onSetCover(img) : undefined}
            />
          ))}

        {/* New images */}
        {newImages.map((item, idx) => (
          <ImageThumb
            key={item.url}
            src={item.url}
            isCover={!isEdit && idx === 0}
            onRemove={() => onRemoveNew(item)}
          />
        ))}
      </div>

      {!isEdit && (
        <p className="text-xs text-gray-400">
          Ảnh đầu tiên là ảnh bìa. Tối đa 10 ảnh, mỗi ảnh ≤ 5 MB.
        </p>
      )}
    </SectionCard>
  );
}
