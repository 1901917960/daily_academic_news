import { chatJson } from './client';

const SYSTEM_PROMPT = '你是学术概念解释助手，擅长给出严谨而清晰的概念界定，也能用生活化的语言把学术概念讲明白。所有输出使用简体中文（中国大陆规范用字）。';

// 获取知识点的学术概念界定
export async function fetchConcept(name, category) {
  const prompt = `请给出学术知识点「${name}」的学术概念界定。
${category ? `它的分类是：${category}。` : ''}

要求：
1. 用 2-3 句话给出严谨、准确的学术定义，体现其核心内涵与适用场景
2. 不超过 120 字
3. 使用简体中文

严格按 JSON 输出：
{ "concept": "概念界定" }`;

  const data = await chatJson({ system: SYSTEM_PROMPT, prompt, temperature: 0.3 });
  return (data.concept || '').trim();
}

// 获取知识点的通俗解释
export async function fetchPlainExplanation(name, concept) {
  const prompt = `请用通俗易懂的方式解释学术知识点「${name}」。
${concept ? `它的学术概念是：${concept}` : ''}

要求：
1. 用一个生活化的类比或具体例子帮助理解，避免堆砌术语
2. 说明它"是什么、有什么用"
3. 不超过 160 字
4. 使用简体中文

严格按 JSON 输出：
{ "plain": "通俗解释" }`;

  const data = await chatJson({ system: SYSTEM_PROMPT, prompt, temperature: 0.3 });
  return (data.plain || '').trim();
}
