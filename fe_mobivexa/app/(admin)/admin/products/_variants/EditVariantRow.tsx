import { Trash2, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ProductVariant } from "@/features/products/types";
import type { RowEdit } from "./types";
import { ColorPickerInput } from "../_shared";
import { VariantImageCell } from "./VariantImageCell";

interface EditVariantRowProps {
  variant: ProductVariant;
  row: RowEdit;
  busy: boolean;
  selectedImage: string | undefined;
  onUpdateRow: (field: keyof RowEdit, value: string) => void;
  onBlur: (field: keyof RowEdit) => void;
  onOpenImagePicker: () => void;
  onRegenerateSku: () => void;
  onRemove: () => void;
}

export function EditVariantRow({
  variant,
  row,
  busy,
  selectedImage,
  onUpdateRow,
  onBlur,
  onOpenImagePicker,
  onRegenerateSku,
  onRemove,
}: EditVariantRowProps) {
  const hasDiscount =
    Number(row.salePrice) > 0 &&
    Number(row.originalPrice) > 0 &&
    Number(row.salePrice) < Number(row.originalPrice);

  return (
    <tr
      className={`group bg-white hover:bg-gray-50/50 ${busy ? "opacity-60" : ""}`}
    >
      {/* Image */}
      <td className="px-3 py-2.5">
        <VariantImageCell imageUrl={selectedImage} onClick={onOpenImagePicker} />
      </td>

      {/* Color */}
      <td className="px-3 py-2.5">
        <ColorPickerInput
          value={row.color}
          disabled={busy}
          onChange={(v) => onUpdateRow("color", v)}
          onBlur={() => onBlur("color")}
        />
      </td>

      {/* RAM */}
      <td className="px-3 py-2.5">
        <Input
          value={row.ram}
          disabled={busy}
          placeholder="ram"
          onChange={(e) => onUpdateRow("ram", e.target.value)}
          onBlur={() => onBlur("ram")}
          className="h-8 min-w-[70px] text-sm"
        />
      </td>

      {/* Storage */}
      <td className="px-3 py-2.5">
        <Input
          value={row.storage}
          disabled={busy}
          placeholder="dung lượng"
          onChange={(e) => onUpdateRow("storage", e.target.value)}
          onBlur={() => onBlur("storage")}
          className="h-8 min-w-[80px] text-sm"
        />
      </td>

      {/* SKU */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1">
          <Input
            value={row.sku}
            disabled={busy}
            placeholder="SKU"
            onChange={(e) => onUpdateRow("sku", e.target.value)}
            onBlur={() => onBlur("sku")}
            className="h-8 min-w-[130px] font-mono text-xs text-[var(--color-primary)]"
          />
          <button
            type="button"
            disabled={busy}
            onClick={onRegenerateSku}
            title="Tự động tạo SKU"
            className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-[var(--color-primary)] disabled:opacity-40"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>

      {/* Original price */}
      <td className="px-3 py-2.5">
        <Input
          type="number"
          value={row.originalPrice}
          disabled={busy}
          placeholder="0"
          onChange={(e) => onUpdateRow("originalPrice", e.target.value)}
          onBlur={() => onBlur("originalPrice")}
          className="h-8 min-w-[110px] text-right text-sm"
        />
      </td>

      {/* Sale price */}
      <td className="px-3 py-2.5">
        <Input
          type="number"
          value={row.salePrice}
          disabled={busy}
          placeholder="—"
          onChange={(e) => onUpdateRow("salePrice", e.target.value)}
          onBlur={() => onBlur("salePrice")}
          className={`h-8 min-w-[110px] text-right text-sm ${hasDiscount ? "text-[var(--color-danger)]" : ""}`}
        />
      </td>

      {/* Stock */}
      <td className="px-3 py-2.5">
        <Input
          type="number"
          value={row.stock}
          disabled={busy}
          placeholder="0"
          onChange={(e) => onUpdateRow("stock", e.target.value)}
          onBlur={() => onBlur("stock")}
          className="h-8 w-20 text-right text-sm"
        />
      </td>

      {/* Delete */}
      <td className="px-2 py-2.5">
        <button
          type="button"
          disabled={busy}
          onClick={onRemove}
          title="Xoá biến thể"
          className="text-gray-300 opacity-0 transition-all hover:text-[var(--color-danger)] group-hover:opacity-100 disabled:cursor-not-allowed"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}
