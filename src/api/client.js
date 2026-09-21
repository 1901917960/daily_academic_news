import OpenAI from 'openai';
import { parseJsonLoose } from '../utils/json';

const DEFAULT_MODEL = 'deepseek-chat';
const DEFAULT_TIMEOUT = 60000;
const ACCESS_CODE_KEY = 'daily_access_code';

let cachedAccessCode = null;
let clientInstance = null;
let clientAccessCode = null;

// 访问码：部署环境需要（开发环境走 Vite 代理，无需访问码）
export function getAccessCode() {
  if (import.meta.env.DEV) return 'dev-mode';
  if (cachedAccessCode !== null) return cachedAccessCode;

  let code = '';
  try {
    code = localStorage.getItem(ACCESS_CODE_KEY) || '';
  } catch { /* ignore */ }

  if (!code && typeof window !== 'undefined') {
    code = (window.prompt('请输入访问码（向站点所有者获取）') || '').trim();
    if (code) {
      try { localStorage.setItem(ACCESS_CODE_KEY, code); } catch { /* ignore */ }
    }
  }

  cachedAccessCode = code;
  return code;
}

export function clearAccessCode() {
  cachedAccessCode = null;
  try { localStorage.removeItem(ACCESS_CODE_KEY); } catch { /* ignore */ }
}

// 请求统一走同源代理 /api/ai，API Key 保存在服务端
function getClient() {
  const code = getAccessCode();
  if (!clientInstance || clientAccessCode !== code) {
    clientInstance = new OpenAI({
      apiKey: code || 'missing',
      baseURL: new URL('/api/ai', window.location.origin).toString(),
      dangerouslyAllowBrowser: true,
      timeout: DEFAULT_TIMEOUT,
      maxRetries: 2
    });
    clientAccessCode = code;
  }
  return clientInstance;
}

// 访问码失效时清除缓存，提示重新输入
function rethrowAuthError(e) {
  if (e && (e.status === 401 || e.status === 403)) {
    clearAccessCode();
    throw new Error('访问码无效，请刷新页面后重新输入');
  }
  throw e;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// JSON 模式的对话调用：超时保护 + 宽松解析 + 解析失败时重试生成
export async function chatJson({
  system,
  prompt,
  temperature = 0.3,
  timeout = DEFAULT_TIMEOUT,
  retries = 1
}) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    // 请求层错误（网络/超时/5xx）由 SDK 的 maxRetries 机制处理，直接向上抛出
    const response = await getClient().chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature,
      timeout
    }).catch(rethrowAuthError);

    const parsed = parseJsonLoose(response.choices[0]?.message?.content);
    if (parsed !== null) return parsed;

    lastError = new Error('AI 返回内容无法解析为 JSON');
    if (attempt < retries) await sleep(800);
  }

  throw lastError;
}

// 流式文本对话：逐段产出内容增量
export async function* chatTextStream({
  system,
  messages,
  temperature = 0.7,
  timeout = 120000
}) {
  const stream = await getClient().chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...messages
    ],
    temperature,
    timeout,
    stream: true
  }).catch(rethrowAuthError);

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}
