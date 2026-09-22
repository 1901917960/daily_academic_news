// 国内 RSS 新闻源代理（EdgeOne Edge Function）
// 作用：白名单转发订阅源（避免 SSRF）、校验访问码
// 路由：/api/rss?source=<key>
// 注意：白名单需与 src/utils/rss.js 中的 RSS_SOURCES 保持一致

const SOURCES = {
  wallstreetcn: 'https://dedicated.wallstreetcn.com/rss.xml',
  chinanews: 'https://www.chinanews.com.cn/rss/finance.xml',
  people: 'http://www.people.com.cn/rss/finance.xml',
  tmtpost: 'https://www.tmtpost.com/rss.xml',
  ifanr: 'https://www.ifanr.com/feed'
};

export default async function onRequest(context) {
  try {
    return await handle(context);
  } catch (e) {
    return jsonError(500, '新闻源代理执行失败: ' + ((e && e.message) || '未知错误'));
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
  const source = url.searchParams.get('source') || '';
  const target = SOURCES[source];
  if (!target) {
    return jsonError(404, '不支持的新闻源');
  }

  const response = await fetch(target, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; DailyAcademicNews/1.0)' }
  });
  const text = await response.text();

  return new Response(text, {
    status: response.status,
    headers: { 'content-type': 'text/xml; charset=utf-8' }
  });
}

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}
