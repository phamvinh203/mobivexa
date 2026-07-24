import { htmlToLines } from '@/lib/utils/html'

export function DescriptionPanel({ description }: { description: string | null }) {
  const lines = htmlToLines(description)

  if (lines.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        Sản phẩm này chưa có mô tả chi tiết.
      </p>
    )
  }

  return (
    <div className="flex max-w-3xl flex-col gap-2.5 text-sm leading-relaxed text-gray-700">
      {lines.map((line, i) =>
        line.bullet ? (
          <p key={i} className="flex gap-2.5 pl-1">
            <span
              aria-hidden
              className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--color-primary)]"
            />
            {line.text}
          </p>
        ) : (
          <p key={i}>{line.text}</p>
        ),
      )}
    </div>
  )
}
