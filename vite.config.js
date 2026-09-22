import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
import { RSS_SOURCES } from './src/utils/rss.js'

// 开发环境的国内 RSS 代理（生产环境由 edge-functions/api/rss 处理）
function devRssProxy() {
  return {
    name: 'dev-rss-proxy',
    configureServer(server) {
      server.middlewares.use('/api/rss', async (req, res) => {
        try {
          const url = new URL(req.url, 'http://localhost')
          const source = url.searchParams.get('source') || ''
          const found = RSS_SOURCES.find(s => s.key === source)

          if (!found) {
            res.statusCode = 404
            res.setHeader('content-type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: { message: '不支持的新闻源' } }))
            return
          }

          const upstream = await fetch(found.url, {
            headers: { 'user-agent': 'Mozilla/5.0 (compatible; DailyAcademicNews/1.0)' }
          })
          const text = await upstream.text()
          res.statusCode = upstream.status
          res.setHeader('content-type', 'text/xml; charset=utf-8')
          res.end(text)
        } catch (e) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: { message: String((e && e.message) || e) } }))
        }
      })
    }
  }
}

// 开发环境的学术文献检索代理（生产环境由 edge-functions/api/papers 处理）
function devPapersProxy() {
  return {
    name: 'dev-papers-proxy',
    configureServer(server) {
      server.middlewares.use('/api/papers', async (req, res) => {
        try {
          const url = new URL(req.url, 'http://localhost')
          const query = (url.searchParams.get('query') || '').trim()

          if (!query) {
            res.statusCode = 400
            res.setHeader('content-type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: { message: '缺少检索关键词' } }))
            return
          }

          const params = new URLSearchParams({
            search: query.slice(0, 200),
            'per-page': '25'
          })

          const upstream = await fetch(`https://api.openalex.org/works?${params}`, {
            headers: { accept: 'application/json' }
          })
          const text = await upstream.text()
          res.statusCode = upstream.status
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(text)
        } catch (e) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: { message: String((e && e.message) || e) } }))
        }
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [vue(), devRssProxy(), devPapersProxy()],
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
