# 每日学术洞察（daily-academic-news）

每天自动抓取当日财经/商业新闻，由 AI 筛选出最有分析价值的一条，并从会计学、管理学、金融学的学术视角生成研究报告，配套学术问答与思维库知识图谱。

## 功能

- 每日新闻：实时抓取当日商业新闻，AI 筛选并生成导语（保留原文链接与国内报道检索）
- 学术分析：核心事实、研究切入点、制度缝隙、参与方博弈、结构类比、核心洞见
- 学术问答：基于当日新闻的多轮追问（流式输出），回答中的知识点自动沉淀到思维库
- 思维库：知识点知识图谱，支持分类分级浏览、拖拽、精确/模糊检索、AI 关联推断、概念与通俗解释
- 数据本地化：所有报告、对话与图谱数据保存在浏览器 localStorage，无需数据库

## 本地开发

1. 安装依赖：`npm install`
2. 在项目根目录创建 `.env` 并填写：

   ```
   DEEPSEEK_API_KEY=你的 DeepSeek 密钥
   CURRENTS_API_KEY=你的 Currents 密钥
   ACCESS_CODE=自定义访问码（开发环境可随意填）
   ```

3. 启动开发服务器：`npm run dev`
4. 运行测试：`npm test`

开发环境下密钥由 Vite 代理在 Node 进程注入，不会进入前端产物。

## 部署（EdgeOne Makers）

1. 将本仓库推送到 GitHub / GitLab / CNB，在 [EdgeOne Makers](https://pages.edgeone.ai/zh) 控制台导入
2. 在项目设置 → 环境变量中配置（与本地 `.env` 同名）：
   - `DEEPSEEK_API_KEY`
   - `CURRENTS_API_KEY`
   - `ACCESS_CODE`
3. 构建命令 `npm run build`，输出目录 `dist`（已写入 `edgeone.json`）
4. 部署完成后将网址与访问码分享给使用者，首次使用需输入访问码

前端所有 AI 与新闻请求都经由同源代理 `/api/ai`、`/api/news`，代理实现在 `edge-functions/` 目录，API Key 仅保存在服务端环境变量中。

## 目录结构

```
src/               前端源码（Vue 3 + Vite）
src/api/           AI 与新闻接口封装（统一走同源代理）
src/composables/   知识图谱等组合式逻辑
src/utils/         纯函数工具（含 Vitest 测试）
edge-functions/    EdgeOne 边缘函数（API 代理 + 访问码校验）
edgeone.json       部署配置（SPA 回退、输出目录）
```
