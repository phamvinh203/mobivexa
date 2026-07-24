import { ImageIcon } from "lucide-react";

export function VariantImageCell({
  imageUrl,
  onClick,
}: {
  imageUrl?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title="Chọn ảnh cho biến thể"
      onClick={onClick}
      className="group/img relative h-9 w-9 overflow-hidden rounded-md border border-dashed border-gray-300 bg-gray-100 transition-colors hover:border-[var(--color-primary)]/60 hover:bg-gray-50"
    >
      {imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
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
  );
}
