"use client";

import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils/format";
import { SectionCard, Toggle } from "../_shared";

interface ProductPublishCardProps {
  isEdit: boolean;
  isActive: boolean;
  onIsActiveChange: (v: boolean) => void;
  isFeatured: boolean;
  onIsFeaturedChange: (v: boolean) => void;
  createdAt?: string;
  submitting: boolean;
  onSaveDraft: () => void;
  onPublish: () => void;
}

export function ProductPublishCard({
  isEdit,
  isActive,
  onIsActiveChange,
  isFeatured,
  onIsFeaturedChange,
  createdAt,
  submitting,
  onSaveDraft,
  onPublish,
}: ProductPublishCardProps) {
  const displayDate = createdAt ? formatDate(createdAt) : "—";

  return (
    <SectionCard title="XUẤT BẢN">
      <div className="space-y-3">
        <Toggle
          label="Trạng thái"
          hint={isActive ? "Đang bán" : "Đã ẩn"}
          checked={isActive}
          onChange={onIsActiveChange}
        />
        <Toggle
          label="Nổi bật"
          hint="Hiển thị ở trang chủ"
          checked={isFeatured}
          onChange={onIsFeaturedChange}
        />

        <div className="flex items-center justify-between border-t border-border/60 pt-3 text-sm">
          <span className="text-gray-500">Ngày tạo</span>
          <span className="font-medium text-gray-700">{displayDate}</span>
        </div>
      </div>

      <div className="border-t border-border/60 pt-4">
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={submitting}
            onClick={onSaveDraft}
          >
            Lưu nháp
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={submitting}
            onClick={onPublish}
          >
            {submitting ? "Đang lưu..." : isEdit ? "Cập nhật" : "Xuất bản ngay"}
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
