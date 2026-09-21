// Currents 新闻代理（EdgeOne Edge Function）
// 作用：隐藏 API Key、校验访问码
// 路由：/api/news/search       -> https://api.currentsapi.services/v1/search
//       /api/news/latest-news  -> https://api.currentsapi.services/v1/latest-news

const UPSTREAM = 'https://api.currentsapi.services/v1';
const ALLOWED = ['/search', '/latest-news'];

export default async function onRequest(context) {
  try {
    return await handle(context);
  } catch (e) {
    return jsonError(500, '新闻代理执行失败: ' + ((e && e.message) || '未知错误'));
  }
}

async function handle(context) {
  const { request } = context;
  const env = context.env || {};

  if (request.method !== 'GET') {
    return jsonError(405, '仅支持 GET 请求');
  }

  const accessCode = env.ACCESS_CODE;
  if (!accessCode) {
    return jsonError(500, '服务端未配置 ACCESS_CODE 环境变量');
  }

  const code = request.headers.get('x-access-code') || '';
  if (code !== accessCode) {
    return jsonError(401, '访问码无效');
  }

  const key = env.CURRENTS_API_KEY;
  if (!key) {
    return jsonError(500, '服务端未配置 CURRENTS_API_KEY 环境变量');
  }

  const url = new URL(request.url);
  const subPath = url.pathname.replace(/^\/api\/news/, '');
  if (!ALLOWED.includes(subPath)) {
    return jsonError(404, '不支持的新闻接口');
  }

  const target = new URL(UPSTREAM + subPath);
  url.searchParams.forEach((value, name) => target.searchParams.set(name, value));
  target.searchParams.set('apiKey', key);

  const response = await fetch(target.toString());
  const body = await response.text();

  return new Response(body, {
    status: response.status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}
