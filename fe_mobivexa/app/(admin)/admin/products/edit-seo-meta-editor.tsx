'use client'

import { SeoMetaCard, type SeoMetaValue } from './create-seo-meta-editor'

interface EditSeoMetaEditorProps {
  initial?: Partial<SeoMetaValue>
  productName?: string
  productSlug?: string
}

export function EditSeoMetaEditor({ initial, productName, productSlug }: EditSeoMetaEditorProps = {}) {
  return (
    <SeoMetaCard
      initial={initial}
      defaultOpen
      productName={productName}
      productSlug={productSlug}
    />
  )
}
