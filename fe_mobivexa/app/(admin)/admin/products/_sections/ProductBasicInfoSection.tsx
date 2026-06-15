"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { SectionCard, RichTextEditor } from "../_shared";

interface ProductBasicInfoSectionProps {
  name: string;
  onNameChange: (v: string) => void;
  slug: string;
  onSlugChange: (v: string) => void;
  onRegenerateSlug: () => void;
  shortDescription: string;
  onShortDescriptionChange: (v: string) => void;
  initialDescription?: string;
  onDescriptionChange: (html: string) => void;
}

export function ProductBasicInfoSection({
  name,
  onNameChange,
  slug,
  onSlugChange,
  onRegenerateSlug,
  shortDescription,
  onShortDescriptionChange,
  initialDescription,
  onDescriptionChange,
}: ProductBasicInfoSectionProps) {
  return (
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
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="tên sản phẩm"
        />
      </div>

      {/* Slug */}
      <div className="space-y-1.5">
        <Label htmlFor="pf-slug">Slug (Đường dẫn tĩnh)</Label>
        <div className="flex gap-2">
          <Input
            id="pf-slug"
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
            placeholder="đường dẫn tĩnh (nên để trống để tự tạo từ tên)"
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={onRegenerateSlug}
            title="Tạo slug từ tên"
            className="h-9 w-9 shrink-0"
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
          onChange={(e) => onShortDescriptionChange(e.target.value)}
          placeholder="Nhập mô tả ngắn gọn về sản phẩm..."
          rows={3}
        />
      </div>

      {/* Mô tả chi tiết */}
      <div className="space-y-1.5">
        <Label>Mô tả chi tiết</Label>
        <RichTextEditor
          initialValue={initialDescription}
          onChange={onDescriptionChange}
        />
      </div>
    </SectionCard>
  );
}
