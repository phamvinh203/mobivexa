import { Star, X } from "lucide-react";

export function ImageThumb({
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
