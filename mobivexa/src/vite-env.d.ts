/// <reference types="vite/client" />

// Khai báo các biến trong .env để import.meta.env có type thay vì any.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_ACCESS_TOKEN_KEY?: string;
  readonly VITE_REFRESH_TOKEN_KEY?: string;
  readonly VITE_USER_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
