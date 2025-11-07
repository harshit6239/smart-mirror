/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MAIN_VITE_WS_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
