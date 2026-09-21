import { chatJson } from './client';

// 模糊搜索：根据用户对知识点内容的描述，语义匹配知识库中的知识点
// nodes: [{ name, category }] -> [{ name, reason }]
export async function semanticSearch(query, nodes) {
  if (!query || !nodes || nodes.length === 0) return [];

  const list = nodes.slice(0, 150);
  const prompt = `用户想查找学术知识库中的知识点，他的描述是：
"${query}"

知识库中的知识点列表：
${list.map((n, i) => `${i + 1}. ${n.name}${n.category ? `（${n.category}）` : ''}`).join('\n')}

请找出与用户描述最相关的知识点（最多 5 个），按相关度从高到低排列。要求：
1. 只选择确实与描述相关的知识点，宁缺毋滥；如果都不相关，返回空数组
2. name 必须与列表中的名称完全一致
3. reason 用不超过 20 字说明为什么匹配

严格按 JSON 输出：
{
  "matches": [
    { "name": "知识点名称", "reason": "匹配原因" }
  ]
}`;

  const data = await chatJson({
    system: '你是学术知识检索助手，负责把用户的自然语言描述匹配到对应的学术知识点。所有输出使用简体中文。',
    prompt,
    temperature: 0.2
  });

  return (data.matches || []).filter(m => m.name);
}
