import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [vue()],
    server: {
      proxy: {
        // 开发环境代理 DeepSeek：密钥只存在于本地 Node 进程，不进前端产物
        '/api/ai': {
          target: 'https://api.deepseek.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ai/, ''),
          configure(proxy) {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('authorization', `Bearer ${env.DEEPSEEK_API_KEY || ''}`)
            })
          }
        },
        // 开发环境代理 Currents 新闻
        '/api/news': {
          target: 'https://api.currentsapi.services',
          changeOrigin: true,
          rewrite: (path) => {
            const [pathname, query] = path.split('?')
            const nextPath = pathname.replace(/^\/api\/news/, '/v1')
            const prefix = query ? `${query}&` : ''
            return `${nextPath}?${prefix}apiKey=${env.CURRENTS_API_KEY || ''}`
          }
        }
      }
    }
  }
})
