// 学术文献检索代理（EdgeOne Edge Function）
// 作用：转发 OpenAlex 检索（隐藏参数细节、校验访问码）
// 路由：/api/papers?query=<英文关键词>

const UPSTREAM = 'https://api.openalex.org/works';

export default async function onRequest(context) {
  try {
    return await handle(context);
  } catch (e) {
    return jsonError(500, '文献检索代理执行失败: ' + ((e && e.message) || '未知错误'));
  }
}

async function handle(context) {
  const { request } = context;
  const env = context.env || {};

  const accessCode = env.ACCESS_CODE;
  if (!accessCode) {
    return jsonError(500, '服务端未配置 ACCESS_CODE 环境变量');
  }

  const code = request.headers.get('x-access-code') || '';
  if (code !== accessCode) {
    return jsonError(401, '访问码无效');
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get('query') || '').trim();
  if (!query) {
    return jsonError(400, '缺少检索关键词');
  }

  const params = new URLSearchParams({
    search: query.slice(0, 200),
    'per-page': '25'
  });

  const response = await fetch(`${UPSTREAM}?${params}`, {
    headers: { accept: 'application/json' }
  });
  const text = await response.text();

  return new Response(text, {
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
