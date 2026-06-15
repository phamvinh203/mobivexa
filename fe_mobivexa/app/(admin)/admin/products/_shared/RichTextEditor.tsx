"use client";

import { useEffect, useRef } from "react";
import {
  Bold,
  Italic,
  Underline,
  List,
  Link as LinkIcon,
  Image as ImageIconRTE,
} from "lucide-react";

interface RichTextEditorProps {
  initialValue?: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({
  initialValue,
  onChange,
  placeholder = "Nhập mô tả chi tiết về sản phẩm...",
}: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (ref.current && !initialized.current && initialValue) {
      ref.current.innerHTML = initialValue;
      initialized.current = true;
    }
  }, [initialValue]);

  return (
    <div className="overflow-hidden rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-input bg-gray-50/80 px-2 py-1.5">
        {(
          [
            { Icon: Bold, title: "Bold", cmd: "bold" },
            { Icon: Italic, title: "Italic", cmd: "italic" },
            { Icon: Underline, title: "Underline", cmd: "underline" },
          ] as const
        ).map(({ Icon, title, cmd }) => (
          <button
            key={cmd}
            type="button"
            title={title}
            onMouseDown={(e) => {
              e.preventDefault();
              document.execCommand(cmd);
            }}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-600 transition-colors hover:bg-gray-200 active:bg-gray-300"
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}

        <div className="mx-1.5 h-4 w-px bg-gray-300" />

        {(
          [
            { label: "H1", title: "Heading 1", arg: "H1" },
            { label: "H2", title: "Heading 2", arg: "H2" },
          ] as const
        ).map(({ label, title, arg }) => (
          <button
            key={label}
            type="button"
            title={title}
            onMouseDown={(e) => {
              e.preventDefault();
              document.execCommand("formatBlock", false, arg);
            }}
            className="flex h-7 items-center justify-center rounded px-1.5 text-[11px] font-bold text-gray-600 transition-colors hover:bg-gray-200"
          >
            {label}
          </button>
        ))}

        <div className="mx-1.5 h-4 w-px bg-gray-300" />

        <button
          type="button"
          title="Danh sách"
          onMouseDown={(e) => {
            e.preventDefault();
            document.execCommand("insertUnorderedList");
          }}
          className="flex h-7 w-7 items-center justify-center rounded text-gray-600 transition-colors hover:bg-gray-200"
        >
          <List className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          title="Liên kết"
          onMouseDown={(e) => {
            e.preventDefault();
            const url = prompt("Nhập URL liên kết:");
            if (url) document.execCommand("createLink", false, url);
          }}
          className="flex h-7 w-7 items-center justify-center rounded text-gray-600 transition-colors hover:bg-gray-200"
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          title="Chèn ảnh"
          onMouseDown={(e) => {
            e.preventDefault();
            const url = prompt("Nhập URL ảnh:");
            if (url) document.execCommand("insertImage", false, url);
          }}
          className="flex h-7 w-7 items-center justify-center rounded text-gray-600 transition-colors hover:bg-gray-200"
        >
          <ImageIconRTE className="h-3.5 w-3.5" />
        </button>

        {/* Table — placeholder */}
        <button
          type="button"
          title="Bảng (chưa hỗ trợ)"
          className="flex h-7 w-7 cursor-not-allowed items-center justify-center rounded text-gray-400"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="1" y="1" width="14" height="14" rx="1" />
            <line x1="1" y1="5" x2="15" y2="5" />
            <line x1="1" y1="9" x2="15" y2="9" />
            <line x1="5" y1="1" x2="5" y2="15" />
            <line x1="10" y1="1" x2="10" y2="15" />
          </svg>
        </button>
      </div>

      {/* Editable area */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        data-placeholder={placeholder}
        className="prose prose-sm min-h-36 max-w-none p-3 text-sm text-gray-700 outline-none empty:before:text-gray-400 empty:before:content-[attr(data-placeholder)]"
      />
    </div>
  );
}
