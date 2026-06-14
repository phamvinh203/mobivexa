'use client'

import { useEffect, useRef, useState } from 'react'
import { assertImageFile } from '@/lib/utils/file'

interface UseImageUploadOptions {
  /** Initial URL to preview (for edit mode) */
  initialUrl?: string | null
}

interface UseImageUploadReturn {
  /** Selected file (ready for upload) */
  file: File | null
  /** Preview URL (either initial URL or object URL from selected file) */
  preview: string | null
  /** Error from last file pick attempt */
  error: string
  /** Clear error state */
  clearError: () => void
  /** Handle file selection from input */
  handlePickFile: (file: File | undefined) => void
  /** Clear both file and preview */
  clearFile: () => void
}

/**
 * Hook quản lý upload ảnh với preview + validation + cleanup object URL.
 * Dùng chung cho các form modal (banner, brand, category...) để tránh duplicate code.
 *
 * @example
 * const { file, preview, handlePickFile, clearFile, error, clearError } = useImageUpload({ initialUrl: editing?.imageUrl })
 */
export function useImageUpload({ initialUrl }: UseImageUploadOptions = {}): UseImageUploadReturn {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(initialUrl ?? null)
  const [error, setError] = useState('')

  // Giữ object URL để cleanup khi unmount hoặc chọn ảnh khác
  const objectUrlRef = useRef<string | null>(null)

  // Cleanup object URL khi unmount
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  function clearError() {
    setError('')
  }

  function clearFile() {
    setFile(null)
    setPreview(initialUrl ?? null)
    setError('')
  }

  function handlePickFile(selectedFile: File | undefined) {
    if (!selectedFile) return

    try {
      assertImageFile(selectedFile)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ảnh không hợp lệ')
      return
    }

    setError('')

    // Cleanup object URL cũ nếu có
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
    }

    // Tạo object URL mới cho preview
    const url = URL.createObjectURL(selectedFile)
    objectUrlRef.current = url
    setFile(selectedFile)
    setPreview(url)
  }

  return {
    file,
    preview,
    error,
    clearError,
    handlePickFile,
    clearFile,
  }
}
