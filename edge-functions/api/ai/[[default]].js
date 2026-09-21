// DeepSeek 代理（EdgeOne Edge Function）
// 作用：隐藏 API Key、校验访问码、透传流式响应
// 路由：/api/ai/*  ->  https://api.deepseek.com/*

const UPSTREAM = 'https://api.deepseek.com';

export default async function onRequest(context) {
  try {
    return await handle(context);
  } catch (e) {
    return jsonError(500, 'AI 代理执行失败: ' + ((e && e.message) || '未知错误'));
  }
}

async function handle(context) {
  const { request } = context;
  const env = context.env || {};

  const accessCode = env.ACCESS_CODE;
  if (!accessCode) {
    return jsonError(500, '服务端未配置 ACCESS_CODE 环境变量');
  }

  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (token !== accessCode) {
    return jsonError(401, '访问码无效');
  }

  const key = env.DEEPSEEK_API_KEY;
  if (!key) {
    return jsonError(500, '服务端未配置 DEEPSEEK_API_KEY 环境变量');
  }

  const url = new URL(request.url);
  const subPath = url.pathname.replace(/^\/api\/ai/, '') || '/';
  const target = UPSTREAM + subPath + url.search;

  const headers = new Headers();
  headers.set('authorization', `Bearer ${key}`);
  headers.set('content-type', request.headers.get('content-type') || 'application/json');
  headers.set('accept', request.headers.get('accept') || 'application/json');

  const init = { method: request.method, headers };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text();
  }

  const response = await fetch(target, init);

  // 透传响应（含流式 SSE）
  return new Response(response.body, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') || 'application/json; charset=utf-8',
      'cache-control': 'no-cache'
    }
  });
}

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}
