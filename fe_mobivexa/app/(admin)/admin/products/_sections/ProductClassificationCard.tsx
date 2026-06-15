"use client";

import { ChevronDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import type { Category } from "@/features/categories/types";
import type { Brand } from "@/features/brands/types";
import { SectionCard, TagPicker } from "../_shared";
import type { Tag } from "@/features/tags/types";

interface ProductClassificationCardProps {
  categories: Category[];
  categoryId: string;
  onCategoryChange: (v: string) => void;
  brands: Brand[];
  brandId: string;
  onBrandChange: (v: string) => void;
  tags: Tag[];
  tagIds: string[];
  onToggleTag: (id: string) => void;
}

export function ProductClassificationCard({
  categories,
  categoryId,
  onCategoryChange,
  brands,
  brandId,
  onBrandChange,
  tags,
  tagIds,
  onToggleTag,
}: ProductClassificationCardProps) {
  return (
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
              onChange={(e) => onCategoryChange(e.target.value)}
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
            Thương hiệu <span className="text-[var(--color-danger)]">*</span>
          </Label>
          <div className="relative">
            <select
              id="pf-brand"
              value={brandId}
              onChange={(e) => onBrandChange(e.target.value)}
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
            onToggle={onToggleTag}
          />
        </div>
      </div>
    </SectionCard>
  );
}
