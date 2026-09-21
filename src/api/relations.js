import { chatJson } from './client';

const SYSTEM_PROMPT = '你是学术知识图谱助手，负责判断学术知识点之间的关联。所有输出使用简体中文（中国大陆规范用字）。';

const BATCH_SIZE = 30;

function pairKey(a, b) {
  return [a, b].sort().join('||');
}

// 为已有的连线生成简要关系说明
// pairs: [{ a, b }] -> { "a||b": "关系说明" }
export async function labelRelations(pairs) {
  const labels = {};
  for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
    const batch = pairs.slice(i, i + BATCH_SIZE);
    const prompt = `以下是学术知识点两两配对，请为每一对给出它们之间的学术关系，用不超过 10 个字的短语概括（如：理论基础、方法互补、共同领域、概念从属、实证支撑、数据同源等）。

${batch.map((p, idx) => `${idx + 1}. ${p.a} ↔ ${p.b}`).join('\n')}

严格按 JSON 输出：
{
  "labels": [
    { "a": "知识点A", "b": "知识点B", "label": "关系说明" }
  ]
}`;
    try {
      const data = await chatJson({ system: SYSTEM_PROMPT, prompt, temperature: 0.2 });
      for (const item of data.labels || []) {
        if (item.a && item.b && item.label) {
          labels[pairKey(item.a, item.b)] = item.label;
        }
      }
    } catch (e) {
      console.error('连线关系标注失败:', e);
    }
  }
  return labels;
}

// 从知识点列表中找出存在关联的知识点对
// names: [string] -> [{ a, b, label }]
export async function suggestRelations(names) {
  if (!names || names.length < 2) return [];
  const list = names.slice(0, 150);
  const prompt = `以下是学术知识库中的知识点列表：

${list.map((n, i) => `${i + 1}. ${n}`).join('\n')}

请找出其中学术上明确相关的知识点对（最多 20 对），并为每对给出不超过 10 个字的关系说明。要求：
1. 只选择确实存在明确学术联系的知识点对，宁缺毋滥，不要强行配对
2. 优先选择方法、理论、领域之间存在支撑、互补、从属、应用关系的组合
3. a 和 b 必须与列表中的名称完全一致

严格按 JSON 输出：
{
  "relations": [
    { "a": "知识点A", "b": "知识点B", "label": "关系说明" }
  ]
}`;

  try {
    const data = await chatJson({ system: SYSTEM_PROMPT, prompt, temperature: 0.2 });
    return (data.relations || []).filter(r => r.a && r.b && r.label);
  } catch (e) {
    console.error('知识点关联发现失败:', e);
    return [];
  }
}
