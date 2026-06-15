import { Trash2, ImageIcon, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { DraftVariant } from "./types";
import { ColorPickerInput } from "../_shared";

interface CreateVariantRowProps {
  draft: DraftVariant;
  showDelete: boolean;
  onUpdate: (field: keyof DraftVariant, value: string) => void;
  onRegenerateSku: () => void;
  onOpenImagePicker: () => void;
  onRemove: () => void;
}

export function CreateVariantRow({
  draft,
  showDelete,
  onUpdate,
  onRegenerateSku,
  onOpenImagePicker,
  onRemove,
}: CreateVariantRowProps) {
  return (
    <tr className="group bg-white hover:bg-gray-50/60">
      {/* Image */}
      <td className="px-3 py-2.5">
        <button
          type="button"
          title="Chọn ảnh cho biến thể"
          onClick={onOpenImagePicker}
          className="group/img relative h-9 w-9 overflow-hidden rounded-md border border-dashed border-gray-300 bg-gray-100 transition-colors hover:border-[var(--color-primary)]/60 hover:bg-gray-50"
        >
          {draft.imageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={draft.imageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover/img:opacity-100">
                <ImageIcon className="h-3.5 w-3.5 text-white" />
              </span>
            </>
          ) : (
            <span className="flex h-full items-center justify-center">
              <ImageIcon className="h-3.5 w-3.5 text-gray-300 transition-colors group-hover/img:text-[var(--color-primary)]/60" />
            </span>
          )}
        </button>
      </td>

      {/* Color */}
      <td className="px-3 py-2.5">
        <ColorPickerInput
          value={draft.color ?? ""}
          onChange={(v) => onUpdate("color", v)}
        />
      </td>

      {/* RAM */}
      <td className="px-3 py-2.5">
        <Input
          placeholder="ram"
          value={draft.ram ?? ""}
          onChange={(e) => onUpdate("ram", e.target.value)}
          className="h-8 min-w-[70px] text-sm"
        />
      </td>

      {/* Storage */}
      <td className="px-3 py-2.5">
        <Input
          placeholder="dung lượng"
          value={draft.storage ?? ""}
          onChange={(e) => onUpdate("storage", e.target.value)}
          className="h-8 min-w-[80px] text-sm"
        />
      </td>

      {/* SKU */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1">
          <Input
            placeholder="SKU"
            value={draft.sku}
            onChange={(e) => onUpdate("sku", e.target.value)}
            className="h-8 min-w-[130px] font-mono text-xs"
          />
          <button
            type="button"
            onClick={onRegenerateSku}
            title="Tự động tạo SKU"
            className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-[var(--color-primary)]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>

      {/* Original price */}
      <td className="px-3 py-2.5">
        <Input
          type="number"
          placeholder="0"
          value={draft.originalPrice || ""}
          onChange={(e) => onUpdate("originalPrice", e.target.value)}
          className="h-8 min-w-[110px] text-right text-sm"
        />
      </td>

      {/* Sale price */}
      <td className="px-3 py-2.5">
        <Input
          type="number"
          placeholder="—"
          value={draft.salePrice || ""}
          onChange={(e) => onUpdate("salePrice", e.target.value)}
          className="h-8 min-w-[110px] text-right text-sm text-[var(--color-danger)] placeholder:text-gray-400"
        />
      </td>

      {/* Stock */}
      <td className="px-3 py-2.5">
        <Input
          type="number"
          placeholder="0"
          value={draft.stock || ""}
          onChange={(e) => onUpdate("stock", e.target.value)}
          className="h-8 w-20 text-right text-sm"
        />
      </td>

      {/* Delete */}
      <td className="px-2 py-2.5">
        {showDelete && (
          <button
            type="button"
            onClick={onRemove}
            title="Xoá biến thể"
            className="text-gray-300 opacity-0 transition-all hover:text-[var(--color-danger)] group-hover:opacity-100"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </td>
    </tr>
  );
}
