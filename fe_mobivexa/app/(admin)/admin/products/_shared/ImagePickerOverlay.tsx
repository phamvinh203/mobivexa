import { X, ImageIcon } from "lucide-react";

export interface PickableImage {
  url: string;
}

export function ImagePickerOverlay({
  images,
  selectedUrl,
  onSelect,
  onClose,
}: {
  images: PickableImage[];
  selectedUrl?: string;
  onSelect: (url: string | undefined) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-80 rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">
            Chọn ảnh biến thể
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {images.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <ImageIcon className="h-8 w-8 text-gray-200" />
            <p className="text-sm text-gray-400">Chưa có ảnh nào.</p>
            <p className="text-xs text-gray-300">
              Thêm ảnh ở mục Hình ảnh sản phẩm trước.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {images.map((img) => {
              const selected = img.url === selectedUrl;
              return (
                <button
                  key={img.url}
                  type="button"
                  onClick={() => onSelect(img.url)}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                    selected
                      ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/30"
                      : "border-transparent hover:border-gray-300"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  {selected && (
                    <span className="absolute inset-0 flex items-center justify-center bg-[var(--color-primary)]/20">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-primary)] text-[10px] text-white">
                        ✓
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {selectedUrl && (
          <button
            type="button"
            onClick={() => onSelect(undefined)}
            className="mt-4 w-full rounded-lg border border-dashed border-gray-200 py-2 text-xs text-gray-400 transition-colors hover:border-red-200 hover:text-[var(--color-danger)]"
          >
            Xoá ảnh biến thể
          </button>
        )}
      </div>
    </div>
  );
}
