// 稳健解析 AI 返回的 JSON 文本：容忍 markdown 围栏、前后杂质
export function parseJsonLoose(text) {
  if (!text || typeof text !== 'string') return null;
  let t = text.trim();

  // 去除 markdown 代码块围栏
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  if (fence) t = fence[1].trim();

  try {
    return JSON.parse(t);
  } catch { /* 继续尝试截取 */ }

  const sliceCandidate = (open, close) => {
    const start = t.indexOf(open);
    const end = t.lastIndexOf(close);
    if (start === -1 || end <= start) return null;
    return t.slice(start, end + 1);
  };

  // 按最先出现的括号类型优先尝试，避免对象截取命中数组内部的片段
  const objStart = t.indexOf('{');
  const arrStart = t.indexOf('[');
  const arrayFirst = arrStart !== -1 && (objStart === -1 || arrStart < objStart);

  const candidates = arrayFirst
    ? [sliceCandidate('[', ']'), sliceCandidate('{', '}')]
    : [sliceCandidate('{', '}'), sliceCandidate('[', ']')];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate);
    } catch { /* 尝试下一个 */ }
  }

  return null;
}
