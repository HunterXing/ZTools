import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import UnoCSS from 'unocss/vite'
import { fileURLToPath, URL } from 'node:url'

// 自建版：官方同步地址使用不可路由的保留域名，确保任何误用都不会真正出站。
const officialSyncServerUrl =
  process.env.ZTOOLS_OFFICIAL_SYNC_SERVER_URL?.trim() || 'https://official.invalid'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  define: {
    __ZTOOLS_OFFICIAL_SYNC_SERVER_URL__: JSON.stringify(officialSyncServerUrl)
  },
  server: {
    port: 5177, // 设置插件开发服务器端口（避免与主程序 5173 冲突）
    strictPort: true,
    open: false
  },
  plugins: [
    vue(),
    UnoCSS(),
    {
      name: 'configure-response-headers',
      configureServer: (server) => {
        server.middlewares.use((_req, res, next) => {
          // 允许加载自定义协议（ztools-icon://）和本地文件（file://）
          res.setHeader(
            'Content-Security-Policy',
            "default-src * 'unsafe-inline' 'unsafe-eval' data: blob: ztools-icon: file:; img-src * data: blob: ztools-icon: file:;"
          )
          next()
        })
      }
    }
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../../src/shared', import.meta.url))
    }
  }
})
