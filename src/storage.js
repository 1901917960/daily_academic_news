import { adjustWeights, setWeight, retractLike } from './utils/preferences';

const KEY = 'daily_academic_news';
const MAX_STORAGE_SIZE = 4 * 1024 * 1024; // 4MB 安全阈值
const MAX_RECORDS = 30; // 最多保留 30 天记录

function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

function saveAll(data) {
  try {
    const jsonStr = JSON.stringify(data);
    
    // 检查容量
    if (jsonStr.length > MAX_STORAGE_SIZE) {
      console.warn('localStorage 容量接近上限，开始清理旧数据');
      cleanupOldRecords(data);
      return;
    }
    
    localStorage.setItem(KEY, jsonStr);
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      console.error('localStorage 已满，尝试清理旧数据');
      cleanupOldRecords(data);
    } else {
      throw e;
    }
  }
}

function cleanupOldRecords(data) {
  // 按日期排序，保留最新的记录
  const sortedDates = Object.keys(data).sort().reverse();
  
  if (sortedDates.length <= MAX_RECORDS) {
    // 如果记录数量在限制内，仍然超出容量，说明单条记录过大
    alert('存储空间不足，无法保存更多数据。请考虑清理部分历史记录。');
    return;
  }
  
  // 删除最旧的记录
  const toKeep = sortedDates.slice(0, MAX_RECORDS);
  const cleaned = {};
  toKeep.forEach(date => {
    cleaned[date] = data[date];
  });
  
  try {
    localStorage.setItem(KEY, JSON.stringify(cleaned));
    alert(`已自动清理 ${sortedDates.length - MAX_RECORDS} 条旧记录以释放空间`);
  } catch (e) {
    alert('存储空间严重不足，请手动清理浏览器缓存');
  }
}

export function getTodayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getRecord(dateKey) {
  return loadAll()[dateKey] || null;
}

export function saveRecord(dateKey, news, analysis) {
  const all = loadAll();
  all[dateKey] = {
    news,
    analysis,
    savedAt: new Date().toISOString()
  };
  saveAll(all);
}

export function getAllRecords() {
  const all = loadAll();
  return Object.entries(all)
    .map(([date, record]) => ({ date, ...record }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

const PREF_KEY = 'daily_academic_prefs';
const PREF_HISTORY_LIMIT = 50;

// 新闻偏好：按新闻类型标签累计权重（锁定 +1，重新生成 -1），并保留学习记录
export function getPreferences() {
  try {
    const data = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    return {
      tags: data.tags || {},
      history: Array.isArray(data.history) ? data.history : []
    };
  } catch {
    return { tags: {}, history: [] };
  }
}

function savePreferences(prefs) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.error('保存偏好失败', e);
  }
}

// 记录偏好信号；meta 传入 { title, date } 时会写入学习历史
export function recordPreference(tags, delta, meta = null) {
  const prefs = getPreferences();
  prefs.tags = adjustWeights(prefs.tags, tags, delta);

  if (meta && (meta.title || meta.date)) {
    prefs.history = [
      {
        ts: Date.now(),
        action: delta > 0 ? 'like' : 'dislike',
        tags: tags || [],
        title: meta.title || '',
        date: meta.date || ''
      },
      ...prefs.history
    ].slice(0, PREF_HISTORY_LIMIT);
  }

  savePreferences(prefs);
}

// 手动调整某标签权重
export function adjustTagWeight(tag, delta) {
  const prefs = getPreferences();
  prefs.tags = adjustWeights(prefs.tags, [tag], delta);
  savePreferences(prefs);
}

// 撤回一次"喜欢"信号（撤销锁定时调用）：移除对应历史记录并回退权重
// 没有对应的喜欢记录时不做任何调整
export function retractPreference(tags, meta = null) {
  const prefs = getPreferences();
  const { history, found } = retractLike(prefs.history, meta);
  if (!found) return;

  prefs.history = history;
  prefs.tags = adjustWeights(prefs.tags, tags, -1);
  savePreferences(prefs);
}

// 手动设置某标签权重
export function setTagWeight(tag, weight) {
  const prefs = getPreferences();
  prefs.tags = setWeight(prefs.tags, tag, weight);
  savePreferences(prefs);
}

// 删除某标签
export function removeTag(tag) {
  const prefs = getPreferences();
  const next = { ...prefs.tags };
  delete next[tag];
  prefs.tags = next;
  savePreferences(prefs);
}

export function resetPreferences() {
  try {
    localStorage.removeItem(PREF_KEY);
  } catch { /* ignore */ }
}

const CHAT_KEY = 'daily_academic_chat';

function loadAllChats() {
  try {
    return JSON.parse(localStorage.getItem(CHAT_KEY) || '{}');
  } catch {
    return {};
  }
}

export function getChat(dateKey) {
  return loadAllChats()[dateKey] || [];
}

export function saveChat(dateKey, messages) {
  const all = loadAllChats();
  all[dateKey] = messages;
  localStorage.setItem(CHAT_KEY, JSON.stringify(all));
}

const CHAT_TREE_KEY = 'daily_academic_chat_tree_v2';

export function getChatTree(dateKey) {
  try {
    const all = JSON.parse(localStorage.getItem(CHAT_TREE_KEY) || '{}');
    return all[dateKey] || { nodes: {}, activeId: null };
  } catch {
    return { nodes: {}, activeId: null };
  }
}

export function saveChatTree(dateKey, tree) {
  try {
    const all = JSON.parse(localStorage.getItem(CHAT_TREE_KEY) || '{}');
    all[dateKey] = tree;
    localStorage.setItem(CHAT_TREE_KEY, JSON.stringify(all));
  } catch (e) {
    console.error('保存对话树失败', e);
  }
}

const KG_KEY = 'daily_academic_kg';
const KG_CHAT_KEY = 'daily_academic_kg_chat'; // 对话中提取的知识点
const KG_MANUAL_KEY = 'daily_academic_kg_manual'; // 手动编辑的节点和边
const KG_AI_KEY = 'daily_academic_kg_ai'; // AI 推断的知识点关联
const KG_CONCEPT_KEY = 'daily_academic_kg_concepts'; // 知识点概念缓存
const LOCK_KEY = 'daily_academic_lock';

export function getKnowledgeBase() {
  try {
    return JSON.parse(localStorage.getItem(KG_KEY) || '{}');
  } catch { return {}; }
}

export function saveKnowledgeForDate(dateKey, points) {
  const kb = getKnowledgeBase();
  kb[dateKey] = points;
  localStorage.setItem(KG_KEY, JSON.stringify(kb));
}

// 获取对话知识点
export function getChatKnowledge() {
  try {
    return JSON.parse(localStorage.getItem(KG_CHAT_KEY) || '{}');
  } catch { return {}; }
}

// 保存对话知识点（按日期分组）
export function saveChatKnowledgeForDate(dateKey, points) {
  const kb = getChatKnowledge();
  if (!kb[dateKey]) {
    kb[dateKey] = [];
  }
  // 合并新知识点，去重
  const existing = new Set(kb[dateKey].map(p => p.name));
  for (const p of points) {
    if (!existing.has(p.name)) {
      kb[dateKey].push(p);
      existing.add(p.name);
    }
  }
  localStorage.setItem(KG_CHAT_KEY, JSON.stringify(kb));
}

// 获取手动编辑的图谱数据
export function getManualGraph() {
  try {
    const data = JSON.parse(localStorage.getItem(KG_MANUAL_KEY) || '{}');
    return {
      nodes: data.nodes || [],
      edges: data.edges || [],
      removedEdges: data.removedEdges || [],
      positions: data.positions || {}
    };
  } catch {
    return { nodes: [], edges: [], removedEdges: [], positions: {} };
  }
}

// 保存手动编辑的图谱数据
export function saveManualGraph(graph) {
  try {
    localStorage.setItem(KG_MANUAL_KEY, JSON.stringify(graph));
  } catch (e) {
    console.error('保存图谱失败', e);
  }
}

// 添加手动节点
export function addManualNode(node) {
  const graph = getManualGraph();
  const newNode = {
    id: node.id || 'manual_' + Date.now(),
    name: node.name,
    category: node.category,
    dates: node.dates || []
  };
  graph.nodes.push(newNode);
  saveManualGraph(graph);
  return newNode;
}

// 更新知识点（自动/对话/手动节点均可重命名和修改分类）
export function updateKnowledgeNode(oldName, newName, newCategory) {
  const rename = oldName !== newName;

  // 1. 新闻分析知识点
  const kb = getKnowledgeBase();
  let changed = false;
  for (const date of Object.keys(kb)) {
    if (!Array.isArray(kb[date])) continue;
    for (const p of kb[date]) {
      if (p.name === oldName) {
        if (rename) p.name = newName;
        if (newCategory) p.category = newCategory;
        changed = true;
      }
    }
  }
  if (changed) localStorage.setItem(KG_KEY, JSON.stringify(kb));

  // 2. 对话知识点
  const chatKb = getChatKnowledge();
  changed = false;
  for (const date of Object.keys(chatKb)) {
    if (!Array.isArray(chatKb[date])) continue;
    for (const p of chatKb[date]) {
      if (p.name === oldName) {
        if (rename) p.name = newName;
        if (newCategory) p.category = newCategory;
        changed = true;
      }
    }
  }
  if (changed) localStorage.setItem(KG_CHAT_KEY, JSON.stringify(chatKb));

  // 3. 手动节点及其关联的手动连线
  const graph = getManualGraph();
  let gChanged = false;
  for (const n of graph.nodes) {
    if (n.name === oldName) {
      if (rename) n.name = newName;
      if (newCategory) n.category = newCategory;
      gChanged = true;
    }
  }
  if (rename) {
    for (const e of graph.edges) {
      if (e.sourceName === oldName) { e.sourceName = newName; gChanged = true; }
      if (e.targetName === oldName) { e.targetName = newName; gChanged = true; }
    }
    // 迁移已保存的节点位置
    if (graph.positions[oldName]) {
      graph.positions[newName] = graph.positions[oldName];
      delete graph.positions[oldName];
      gChanged = true;
    }
  }
  if (gChanged) saveManualGraph(graph);

  // 4. 迁移 AI 推断的关联
  if (rename) {
    const ai = getAIRelations();
    for (const e of ai.edges) {
      if (e.a === oldName) e.a = newName;
      if (e.b === oldName) e.b = newName;
    }
    ai.analyzedNodes = ai.analyzedNodes.map(n => n === oldName ? newName : n);
    const newLabels = {};
    for (const [key, label] of Object.entries(ai.labels)) {
      const parts = key.split('||').map(p => p === oldName ? newName : p).sort();
      newLabels[parts.join('||')] = label;
    }
    ai.labels = newLabels;
    saveAIRelations(ai);
  }

  // 5. 迁移概念缓存
  if (rename) {
    try {
      const cache = JSON.parse(localStorage.getItem(KG_CONCEPT_KEY) || '{}');
      if (cache[oldName]) {
        cache[newName] = cache[oldName];
        delete cache[oldName];
        localStorage.setItem(KG_CONCEPT_KEY, JSON.stringify(cache));
      }
    } catch { /* 忽略缓存迁移失败 */ }
  }
}

// 删除知识点（自动/对话/手动节点均可删除，同时删除相关连线）
export function deleteKnowledgeNode(node) {
  const name = node.name;

  // 1. 从新闻分析知识点中删除
  const kb = getKnowledgeBase();
  let changed = false;
  for (const date of Object.keys(kb)) {
    if (!Array.isArray(kb[date])) continue;
    const before = kb[date].length;
    kb[date] = kb[date].filter(p => p.name !== name);
    if (kb[date].length !== before) changed = true;
  }
  if (changed) localStorage.setItem(KG_KEY, JSON.stringify(kb));

  // 2. 从对话知识点中删除
  const chatKb = getChatKnowledge();
  changed = false;
  for (const date of Object.keys(chatKb)) {
    if (!Array.isArray(chatKb[date])) continue;
    const before = chatKb[date].length;
    chatKb[date] = chatKb[date].filter(p => p.name !== name);
    if (chatKb[date].length !== before) changed = true;
  }
  if (changed) localStorage.setItem(KG_CHAT_KEY, JSON.stringify(chatKb));

  // 3. 从手动节点、手动连线和保存的位置中删除
  const graph = getManualGraph();
  graph.nodes = graph.nodes.filter(n => n.name !== name);
  graph.edges = graph.edges.filter(e =>
    e.sourceName !== name && e.targetName !== name &&
    e.source !== node.id && e.target !== node.id
  );
  delete graph.positions[name];
  saveManualGraph(graph);

  // 4. 清理 AI 推断的关联
  const ai = getAIRelations();
  ai.edges = ai.edges.filter(e => e.a !== name && e.b !== name);
  ai.analyzedNodes = ai.analyzedNodes.filter(n => n !== name);
  for (const key of Object.keys(ai.labels)) {
    if (key.split('||').includes(name)) delete ai.labels[key];
  }
  saveAIRelations(ai);

  // 5. 清理概念缓存
  try {
    const cache = JSON.parse(localStorage.getItem(KG_CONCEPT_KEY) || '{}');
    if (cache[name]) {
      delete cache[name];
      localStorage.setItem(KG_CONCEPT_KEY, JSON.stringify(cache));
    }
  } catch { /* 忽略缓存清理失败 */ }
}

// 添加手动连线（按知识点名称记录）
export function addManualEdge(sourceName, targetName, weight = 1) {
  const graph = getManualGraph();
  const key = [sourceName, targetName].sort().join('||');
  const exists = graph.edges.some(e => {
    const a = e.sourceName || '';
    const b = e.targetName || '';
    return [a, b].sort().join('||') === key;
  });
  if (exists) return null;

  const newEdge = {
    id: 'manual_edge_' + Date.now(),
    sourceName,
    targetName,
    weight
  };
  graph.edges.push(newEdge);
  // 如果这条线之前被删除过，取消屏蔽
  graph.removedEdges = graph.removedEdges.filter(k => k !== key);
  saveManualGraph(graph);
  return newEdge;
}

// 删除连线（手动连线直接删除；自动/对话连线加入屏蔽列表）
export function deleteKnowledgeEdge(edge) {
  const graph = getManualGraph();
  const isManual = graph.edges.some(e => e.id === edge.id);
  if (isManual) {
    graph.edges = graph.edges.filter(e => e.id !== edge.id);
  } else if (edge.a && edge.b) {
    const key = [edge.a, edge.b].sort().join('||');
    if (!graph.removedEdges.includes(key)) graph.removedEdges.push(key);
  }
  saveManualGraph(graph);
}

// 保存节点位置（按名称，拖动过的节点固定在保存的位置）
export function saveNodePositions(positionMap) {
  const graph = getManualGraph();
  graph.positions = { ...graph.positions, ...positionMap };
  saveManualGraph(graph);
}

// 清除所有保存的节点位置
export function clearNodePositions() {
  const graph = getManualGraph();
  graph.positions = {};
  saveManualGraph(graph);
}

// 清除单个节点的保存位置
export function removeNodePosition(name) {
  const graph = getManualGraph();
  delete graph.positions[name];
  saveManualGraph(graph);
}

// 图谱界面偏好设置
const KG_PREF_KEY = 'daily_academic_kg_prefs';

export function getGraphPrefs() {
  try {
    return JSON.parse(localStorage.getItem(KG_PREF_KEY) || '{}');
  } catch {
    return {};
  }
}

export function setGraphPrefs(updates) {
  try {
    const prefs = getGraphPrefs();
    Object.assign(prefs, updates);
    localStorage.setItem(KG_PREF_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.error('保存图谱设置失败', e);
  }
}

// 获取知识点的概念缓存
export function getConcept(name) {
  try {
    const cache = JSON.parse(localStorage.getItem(KG_CONCEPT_KEY) || '{}');
    return cache[name] || null;
  } catch {
    return null;
  }
}

// 保存知识点的概念（学术界定 / 通俗解释）
export function saveConcept(name, data) {
  try {
    const cache = JSON.parse(localStorage.getItem(KG_CONCEPT_KEY) || '{}');
    cache[name] = { ...(cache[name] || {}), ...data, updatedAt: Date.now() };
    localStorage.setItem(KG_CONCEPT_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error('保存概念失败', e);
  }
}

// 获取 AI 推断的知识点关联
export function getAIRelations() {
  try {
    const data = JSON.parse(localStorage.getItem(KG_AI_KEY) || '{}');
    return {
      labels: data.labels || {},       // "a||b" -> 关系说明
      edges: data.edges || [],         // [{ a, b }]
      analyzedNodes: data.analyzedNodes || []
    };
  } catch {
    return { labels: {}, edges: [], analyzedNodes: [] };
  }
}

// 保存 AI 推断的知识点关联
export function saveAIRelations(data) {
  try {
    localStorage.setItem(KG_AI_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('保存 AI 关联失败', e);
  }
}

// 记录 AI 分析结果（新增关联、关系标注、已分析的知识点）
export function recordAIRelations({ newEdges, labels, analyzedNodes }) {
  const data = getAIRelations();
  Object.assign(data.labels, labels || {});

  for (const e of newEdges || []) {
    const key = [e.a, e.b].sort().join('||');
    const exists = data.edges.some(x => [x.a, x.b].sort().join('||') === key);
    if (!exists) data.edges.push({ a: e.a, b: e.b });
  }

  if (analyzedNodes && analyzedNodes.length > 0) {
    data.analyzedNodes = Array.from(new Set([...data.analyzedNodes, ...analyzedNodes]));
  }

  saveAIRelations(data);
}

// 汇总节点和边（自动提取 + 对话提取 + 手动编辑）
export function getAllKnowledge() {
  const kb = getKnowledgeBase();
  const chatKb = getChatKnowledge();
  const manual = getManualGraph();
  const nodes = new Map(); // 名称 -> 节点
  const edges = new Map(); // "a||b"（名称排序） -> { id, a, b, weight }

  const ensureNode = (name, category, source) => {
    if (!nodes.has(name)) {
      nodes.set(name, {
        id: source + '_' + name,
        name,
        category,
        dates: [],
        source
      });
    }
    const node = nodes.get(name);
    if (source === 'chat' && node.source === 'auto') node.source = 'mixed';
    return node;
  };

  const ensureEdge = (nameA, nameB, idPrefix) => {
    const [a, b] = [nameA, nameB].sort();
    const key = a + '||' + b;
    if (!edges.has(key)) {
      edges.set(key, { id: idPrefix + '_' + key, a, b, weight: 0 });
    }
    edges.get(key).weight++;
  };

  // 1. 新闻分析提取的知识点
  for (const [date, points] of Object.entries(kb)) {
    if (!Array.isArray(points)) continue;
    for (const p of points) {
      const node = ensureNode(p.name, p.category, 'auto');
      if (!node.dates.includes(date)) node.dates.push(date);
    }
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        ensureEdge(points[i].name, points[j].name, 'auto');
      }
    }
  }

  // 2. 对话追问提取的知识点
  for (const [date, points] of Object.entries(chatKb)) {
    if (!Array.isArray(points)) continue;
    for (const p of points) {
      const node = ensureNode(p.name, p.category, 'chat');
      if (!node.dates.includes(date)) node.dates.push(date);
    }
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        ensureEdge(points[i].name, points[j].name, 'chat');
      }
    }
  }

  // 3. 手动新增的节点
  for (const n of manual.nodes) {
    if (!nodes.has(n.name)) {
      nodes.set(n.name, {
        id: n.id,
        name: n.name,
        category: n.category,
        dates: n.dates || [],
        source: 'manual'
      });
    }
  }

  // 4. 手动新增的连线（兼容旧版按 id 存储的数据）
  const nameOfId = new Map();
  for (const n of nodes.values()) nameOfId.set(n.id, n.name);
  for (const e of manual.edges) {
    const sourceName = e.sourceName || nameOfId.get(e.source);
    const targetName = e.targetName || nameOfId.get(e.target);
    if (!sourceName || !targetName) continue;
    const [a, b] = [sourceName, targetName].sort();
    const key = a + '||' + b;
    if (!edges.has(key)) {
      edges.set(key, { id: e.id, a, b, weight: e.weight || 1 });
    }
  }

  // 5. AI 推断的知识点关联
  const ai = getAIRelations();
  for (const e of ai.edges) {
    const [a, b] = [e.a, e.b].sort();
    const key = a + '||' + b;
    if (!edges.has(key)) {
      edges.set(key, { id: 'ai_' + key, a, b, weight: 1 });
    }
  }

  // 6. 应用被删除的连线
  for (const key of manual.removedEdges) {
    edges.delete(key);
  }

  // 7. 附加关系说明
  for (const e of edges.values()) {
    const label = ai.labels[e.a + '||' + e.b];
    if (label) e.label = label;
  }

  // 8. 恢复保存的节点位置（仅作为初始位置，节点仍可动态调整）
  for (const node of nodes.values()) {
    const pos = manual.positions[node.name];
    if (pos) {
      node.x = pos.x;
      node.y = pos.y;
    }
  }

  // 9. 生成渲染用的边（source/target 为节点 id）
  const byName = new Map();
  for (const n of nodes.values()) byName.set(n.name, n);
  const renderEdges = [];
  for (const e of edges.values()) {
    const nodeA = byName.get(e.a);
    const nodeB = byName.get(e.b);
    if (!nodeA || !nodeB) continue;
    renderEdges.push({
      id: e.id,
      a: e.a,
      b: e.b,
      source: nodeA.id,
      target: nodeB.id,
      weight: e.weight,
      label: e.label || ''
    });
  }

  return {
    nodes: Array.from(nodes.values()),
    edges: renderEdges
  };
}

// 锁定
export function isLocked(dateKey) {
  try {
    const all = JSON.parse(localStorage.getItem(LOCK_KEY) || '{}');
    return !!all[dateKey];
  } catch { return false; }
}

export function setLocked(dateKey, locked) {
  const all = JSON.parse(localStorage.getItem(LOCK_KEY) || '{}');
  if (locked) all[dateKey] = true;
  else delete all[dateKey];
  localStorage.setItem(LOCK_KEY, JSON.stringify(all));
}