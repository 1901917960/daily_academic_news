<template>
  <Teleport to="body">
    <div class="kg-overlay" @click.self="$emit('close')">
      <div class="kg-modal">
        <div class="kg-header">
          <h2>🧠 思维库</h2>
          <div class="kg-toolbar">
            <button class="kg-btn" @click="autoLinkKnowledge(true)" :disabled="analyzing" title="让 AI 重新检查知识点关联">
              {{ analyzing ? '分析中…' : 'AI 关联' }}
            </button>
            <button
              class="kg-btn"
              :class="{ 'kg-btn-active': showAllLabels }"
              @click="toggleEdgeLabels"
              :title="showAllLabels ? '当前全部显示关系标注，点击切换为仅点击节点时显示' : '当前仅点击节点时显示关系标注，点击切换为全部显示'"
            >
              {{ showAllLabels ? '标注全显' : '点击显示' }}
            </button>
            <button class="kg-btn" @click="resetLayout" title="重新布局">重新布局</button>
            <button class="kg-btn" @click="toggleSimulation" :title="simulationRunning ? '暂停模拟' : '启动模拟'">
              {{ simulationRunning ? '⏸ 暂停' : '▶ 启动' }}
            </button>
          </div>
          <button class="kg-close" @click="$emit('close')">×</button>
        </div>
        <div class="kg-info">
          <span v-if="stats.nodeCount > 0">
            {{ stats.nodeCount }} 个知识点 · {{ stats.edgeCount }} 条关联 · 来自 {{ stats.dayCount }} 天的分析
          </span>
          <span v-else>暂无知识点</span>
          <span v-if="aiStatus" class="kg-ai-status">{{ aiStatus }}</span>
        </div>
        <div class="kg-breadcrumb">
          <template v-if="activeCategory">
            <button class="kg-link-btn" @click="backToOverview">← 全部分类</button>
            <span class="kg-breadcrumb-sep">/</span>
            <span class="kg-breadcrumb-current">{{ activeCategory }}</span>
            <label class="kg-breadcrumb-toggle">
              <input
                id="kg-show-neighbors"
                name="kgShowNeighbors"
                type="checkbox"
                :checked="includeNeighbors"
                @change="setIncludeNeighbors($event.target.checked)"
              >
              显示关联的其他类知识点
            </label>
          </template>
          <template v-else>
            <span class="kg-breadcrumb-hint">分类总览 · 点击分类查看其中的知识点</span>
          </template>
        </div>
        <div v-if="connectingFrom" class="kg-connect-hint">
          正在从「{{ connectingFrom.name }}」创建连线：点击目标节点完成，点击空白处或按 Esc 取消
        </div>
        <div class="kg-search">
          <div class="kg-search-modes">
            <button
              class="kg-search-mode"
              :class="{ active: searchMode === 'exact' }"
              @click="setSearchMode('exact')"
              title="按知识点名称搜索"
            >精确</button>
            <button
              class="kg-search-mode"
              :class="{ active: searchMode === 'fuzzy' }"
              @click="setSearchMode('fuzzy')"
              title="用自然语言描述知识点内容，智能匹配"
            >模糊</button>
          </div>
          <input
            id="kg-search"
            name="kgSearch"
            autocomplete="off"
            v-model="searchQuery"
            :placeholder="searchMode === 'exact' ? '输入知识点名称，如：双重差分法' : '描述你记得的内容，如：评估政策效果的方法'"
            @input="onSearchInput"
            @keydown.enter="doSearch"
          >
          <button class="kg-btn" :disabled="searching || !searchQuery.trim()" @click="doSearch">
            {{ searching ? '匹配中…' : '搜索' }}
          </button>
          <button v-if="searchPerformed" class="kg-btn" @click="resetSearch">清除</button>
        </div>
        <div v-if="searchPerformed" class="kg-search-results">
          <div v-if="searching" class="kg-search-empty">正在智能匹配…</div>
          <div v-else-if="searchError" class="kg-search-empty kg-search-error">{{ searchError }}</div>
          <template v-else-if="searchResults.length > 0">
            <div
              v-for="r in searchResults"
              :key="r.name"
              class="kg-search-result"
              @click="focusResult(r.name)"
            >
              <span class="kg-search-name">{{ r.name }}</span>
              <span class="kg-search-cat">{{ r.category }}</span>
              <span v-if="r.reason" class="kg-search-reason">{{ r.reason }}</span>
            </div>
          </template>
          <div v-else class="kg-search-empty">未找到匹配的知识点</div>
        </div>
        <div class="kg-canvas-wrap" 
             @contextmenu.prevent="onCanvasRightClick"
             @wheel.prevent="onWheel"
             @mousedown="handleCanvasMouseDown">
          <div v-if="stats.nodeCount === 0" class="kg-empty">
            还没有知识点。<br>
            生成日报时会自动提取，之后每天都会累积。
          </div>
          <svg v-else 
               class="kg-svg" 
               :viewBox="`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`"
               ref="svgEl">
            <g v-for="e in displayEdges" :key="e.id">
              <line
                :x1="e.x1" :y1="e.y1" :x2="e.x2" :y2="e.y2"
                :stroke-width="2 + Math.min(e.weight, 5) * 0.8"
                stroke="#94a3b8"
                stroke-opacity="0.3"
                :class="['kg-edge', { 'kg-edge-active': isIncidentEdge(e), 'kg-edge-dimmed': e.dimmed }]"
                @contextmenu.prevent.stop="onEdgeRightClick($event, e)"
              >
                <title>{{ e.label || '连线（右键可删除）' }}</title>
              </line>
              <text
                v-if="e.label && shouldShowEdgeLabel(e)"
                :x="(e.x1 + e.x2) / 2"
                :y="(e.y1 + e.y2) / 2 - 4"
                class="kg-edge-label"
                text-anchor="middle"
              >{{ e.label }}</text>
            </g>
            <g
              v-for="n in nodes"
              :key="n.id"
              class="kg-node"
              :class="{ 'kg-node-selected': selected?.id === n.id, 'kg-node-dragging': dragging?.id === n.id, 'kg-node-matched': matchedNames.has(n.name), 'kg-node-dimmed': n.dimmed }"
              @mousedown.stop="onNodeMouseDown($event, n)"
              @click.stop="onNodeClick(n)"
              @contextmenu.prevent.stop="onNodeRightClick($event, n)"
            >
              <circle
                :cx="n.x" :cy="n.y"
                :r="radiusFor(n)"
                :fill="colorFor(n.category, n.source)"
                fill-opacity="0.85"
                :stroke="selected?.id === n.id ? '#fff' : '#f8fafc'"
                :stroke-width="selected?.id === n.id ? 3 : 2"
              />
              <text
                v-if="n.isCategory"
                :x="n.x" :y="n.y + 5"
                text-anchor="middle"
                class="kg-cat-count"
              >{{ n.count }}</text>
              <text
                :x="n.x" 
                :y="n.y - radiusFor(n) - 8"
                text-anchor="middle"
                class="kg-label"
                fill="#1e293b"
                :font-size="n.isCategory ? 15 : 13"
                :font-weight="n.isCategory ? 600 : 500"
              >{{ n.name }}</text>
            </g>
          </svg>
        </div>
        <div v-if="selected" class="kg-detail">
          <div class="kg-detail-head">
            <span class="kg-detail-title">{{ selected.name }}</span>
            <span class="kg-detail-cat">{{ selected.category }}</span>
            <span v-if="selected.dates && selected.dates.length" class="kg-detail-dates">
              出现在：{{ selected.dates.slice().sort().reverse().join('、') }}
            </span>
          </div>

          <div class="kg-concept">
            <div v-if="conceptLoading" class="kg-concept-muted">正在获取概念…</div>
            <div v-else-if="conceptError" class="kg-concept-muted kg-concept-error">
              {{ conceptError }}
              <button class="kg-link-btn" @click="retryConcept">重试</button>
            </div>
            <div v-else-if="conceptInfo?.concept" class="kg-concept-text">{{ conceptInfo.concept }}</div>
            <div v-else class="kg-concept-muted">暂无概念</div>
          </div>

          <div class="kg-plain">
            <button
              class="kg-plain-toggle"
              :disabled="conceptLoading"
              @click="togglePlain"
            >
              {{ plainOpen ? '▾ 收起通俗解释' : '▸ 通俗解释' }}
            </button>
            <div v-if="plainOpen" class="kg-plain-body">
              <span v-if="plainLoading" class="kg-concept-muted">正在生成通俗解释…</span>
              <span v-else-if="conceptInfo?.plain">{{ conceptInfo.plain }}</span>
              <span v-else class="kg-concept-muted">暂时无法生成解释，请稍后重试</span>
            </div>
          </div>
        </div>
        <div class="kg-legend">
          <span v-for="cat in categories" :key="cat" class="kg-legend-item">
            <span class="kg-dot" :style="{ background: colorFor(cat, 'auto') }"></span>
            {{ cat }}
          </span>
          <span class="kg-legend-item">
            <span class="kg-dot" :style="{ background: '#ff6b35' }"></span>
            对话追问
          </span>
          <span class="kg-legend-item kg-legend-note">点击节点可高亮并查看其关联关系</span>
        </div>

        <!-- 右键菜单 -->
        <div v-if="contextMenu.show" 
             class="kg-context-menu"
             :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }">
          <template v-if="contextMenu.type === 'node'">
            <div class="kg-menu-item" @click="editNode">编辑节点</div>
            <div class="kg-menu-item" @click="startConnecting">创建连线</div>
            <div v-if="contextMenu.target.fixed" class="kg-menu-item" @click="unpinNode">解除固定</div>
            <div class="kg-menu-item kg-menu-danger" @click="deleteNode">删除节点</div>
          </template>
          <template v-if="contextMenu.type === 'edge'">
            <div class="kg-menu-item kg-menu-danger" @click="deleteEdge">删除连线</div>
          </template>
          <template v-if="contextMenu.type === 'canvas'">
            <div class="kg-menu-item" @click="createNode">新建节点</div>
            <div class="kg-menu-item" @click="resetLayout">重新布局</div>
          </template>
        </div>

        <!-- 编辑节点弹窗 -->
        <div v-if="editDialog.show" class="kg-dialog-overlay" @click.self="closeEditDialog">
          <div class="kg-dialog">
            <h3>{{ editDialog.isNew ? '新建节点' : '编辑节点' }}</h3>
            <label>
              名称
              <input
                id="kg-node-name"
                name="kgNodeName"
                autocomplete="off"
                v-model="editDialog.name"
                type="text"
                placeholder="知识点名称"
                maxlength="20"
              >
            </label>
            <label>
              分类
              <select id="kg-node-category" name="kgNodeCategory" v-model="editDialog.category">
                <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
              </select>
            </label>
            <div class="kg-dialog-actions">
              <button class="kg-btn" @click="closeEditDialog">取消</button>
              <button class="kg-btn kg-btn-primary" @click="saveNode">保存</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import {
  addManualNode,
  updateKnowledgeNode,
  deleteKnowledgeNode,
  addManualEdge,
  deleteKnowledgeEdge,
  saveNodePositions,
  removeNodePosition,
  getGraphPrefs,
  setGraphPrefs,
  getAIRelations,
  recordAIRelations
} from '../storage';
import { labelRelations, suggestRelations } from '../api/relations';
import { useForceGraph } from '../composables/useForceGraph';
import { useKnowledgeSearch } from '../composables/useKnowledgeSearch';
import { useConceptPanel } from '../composables/useConceptPanel';

defineEmits(['close']);

const categories = ['理论框架', '研究方法', '研究领域', '数据来源', '核心概念'];

const colorMap = {
  '理论框架': '#6366f1',
  '研究方法': '#10b981',
  '研究领域': '#f59e0b',
  '数据来源': '#ec4899',
  '核心概念': '#8b5cf6'
};

function colorFor(cat, source) {
  // 对话知识点使用特殊的橙红色
  if (source === 'chat') return '#ff6b35';
  if (source === 'mixed') return '#ff8c42';
  return colorMap[cat] || '#94a3b8';
}

// 节点半径：分类节点按包含的知识点数量；关联的其他类节点更小
function radiusFor(n) {
  if (n.isCategory) return 22 + Math.min(n.count || 0, 30);
  if (n.dimmed) return 10 + Math.min(n.dates.length, 8) * 1.5;
  return 12 + Math.min(n.dates.length, 8) * 2;
}

/* ---------- 图谱引擎（布局 / 模拟 / 视口 / 拖拽 / 分级视图） ---------- */
const {
  allNodes,
  allEdges,
  nodes,
  edges,
  activeCategory,
  includeNeighbors,
  selected,
  dragging,
  simulationRunning,
  viewBox,
  svgEl,
  stats,
  displayEdges,
  toGraphPoint,
  loadData,
  resetLayout,
  toggleSimulation,
  wake,
  stop,
  drillInto,
  backToOverview,
  setIncludeNeighbors,
  focusNode,
  onNodeMouseDown,
  onMouseMove,
  onMouseUp,
  onCanvasMouseDown,
  onWheel
} = useForceGraph(categories);

/* ---------- 概念面板 ---------- */
const {
  conceptInfo,
  conceptLoading,
  conceptError,
  plainOpen,
  plainLoading,
  retryConcept,
  togglePlain
} = useConceptPanel(selected);

/* ---------- 检索 ---------- */
const {
  searchMode,
  searchQuery,
  searchResults,
  searching,
  searchError,
  searchPerformed,
  matchedNames,
  resetSearch,
  onSearchInput,
  setSearchMode,
  doSearch,
  focusResult
} = useKnowledgeSearch({
  getNodes: () => allNodes.value,
  onFocus: (node) => focusNode(node.name)
});

/* ---------- 界面状态 ---------- */
const analyzing = ref(false);
const aiStatus = ref('');
const showAllLabels = ref(getGraphPrefs().showEdgeLabels !== false);
const contextMenu = ref({ show: false, x: 0, y: 0, type: '', target: null });
const editDialog = ref({ show: false, isNew: false, node: null, name: '', category: '核心概念' });
const connectingFrom = ref(null);

// 关系标注显示控制
function toggleEdgeLabels() {
  showAllLabels.value = !showAllLabels.value;
  setGraphPrefs({ showEdgeLabels: showAllLabels.value });
}

function isIncidentEdge(e) {
  if (!selected.value) return false;
  return e.source === selected.value.id || e.target === selected.value.id;
}

function shouldShowEdgeLabel(e) {
  if (showAllLabels.value) return true;
  return isIncidentEdge(e);
}

/* ---------- 节点交互 ---------- */
function onNodeClick(node) {
  // 一级视图：点击分类节点进入二级明细
  if (node.isCategory) {
    connectingFrom.value = null;
    drillInto(node.category);
    return;
  }

  if (connectingFrom.value) {
    // 正在连线模式：点击目标节点完成连线
    if (connectingFrom.value.id !== node.id) {
      addManualEdge(connectingFrom.value.name, node.name, 1);
      loadData(true);
    }
    connectingFrom.value = null;
  } else {
    selected.value = node;
  }
}

// 画布按下：取消连线 / 取消选中 / 开始平移
function handleCanvasMouseDown(event) {
  if (event.button === 0 && !event.target.closest('.kg-node')) {
    if (connectingFrom.value) {
      connectingFrom.value = null;
      return;
    }
    selected.value = null;
  }
  onCanvasMouseDown(event);
}

/* ---------- 右键菜单 ---------- */
function onNodeRightClick(event, node) {
  // 分类节点不可编辑
  if (node.isCategory) return;
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    type: 'node',
    target: node
  };
}

function onEdgeRightClick(event, edge) {
  // 分类聚合连线不可删除
  if (edge.isCategoryEdge) return;
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    type: 'edge',
    target: edge
  };
}

function onCanvasRightClick(event) {
  const p = toGraphPoint(event);
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    type: 'canvas',
    target: { x: p.x, y: p.y }
  };
}

function closeContextMenu() {
  contextMenu.value.show = false;
}

/* ---------- 节点增删改 ---------- */
function createNode() {
  editDialog.value = {
    show: true,
    isNew: true,
    node: null,
    name: '',
    category: '核心概念',
    x: contextMenu.value.target.x,
    y: contextMenu.value.target.y
  };
  contextMenu.value.show = false;
}

function editNode() {
  const node = contextMenu.value.target;
  editDialog.value = {
    show: true,
    isNew: false,
    node,
    name: node.name,
    category: node.category
  };
  contextMenu.value.show = false;
}

function saveNode() {
  const name = editDialog.value.name.trim();
  if (!name) {
    alert('请输入节点名称');
    return;
  }

  if (editDialog.value.isNew) {
    addManualNode({
      name,
      category: editDialog.value.category,
      dates: []
    });
    saveNodePositions({
      [name]: { x: editDialog.value.x, y: editDialog.value.y }
    });
  } else {
    const original = editDialog.value.node;
    if (name !== original.name && allNodes.value.some(n => n.name === name)) {
      alert('已存在同名知识点，请换一个名称');
      return;
    }
    updateKnowledgeNode(original.name, name, editDialog.value.category);
  }

  loadData(true);
  // 切换到该知识点所在分类并选中，便于立即看到结果
  focusNode(name);
  closeEditDialog();
}

function deleteNode() {
  const node = contextMenu.value.target;
  if (confirm(`确定删除节点"${node.name}"吗？相关连线会一并删除。`)) {
    deleteKnowledgeNode(node);
    loadData(true);
    selected.value = null;
  }
  contextMenu.value.show = false;
}

function deleteEdge() {
  const edge = contextMenu.value.target;
  if (confirm('确定删除这条连线吗？')) {
    deleteKnowledgeEdge(edge);
    loadData(true);
  }
  contextMenu.value.show = false;
}

function startConnecting() {
  connectingFrom.value = contextMenu.value.target;
  contextMenu.value.show = false;
}

// 解除节点固定，恢复动态模拟
function unpinNode() {
  const node = contextMenu.value.target;
  node.fixed = false;
  node.vx = 0;
  node.vy = 0;
  removeNodePosition(node.name);
  wake();
  contextMenu.value.show = false;
}

function onKeyDown(e) {
  if (e.key === 'Escape') {
    contextMenu.value.show = false;
    connectingFrom.value = null;
    editDialog.value.show = false;
  }
}

function closeEditDialog() {
  editDialog.value.show = false;
}

/* ---------- AI 关联 ---------- */
// 打开思维库时自动检索知识点关联：为新连线生成关系说明，并发现新知识点与已有知识点的联系
async function autoLinkKnowledge(force = false) {
  if (analyzing.value) return;
  if (allNodes.value.length < 2) return;

  analyzing.value = true;
  aiStatus.value = '正在检索知识点关联...';

  try {
    const ai = getAIRelations();
    const known = new Set(ai.analyzedNodes);
    const labels = {};
    const newEdges = [];

    // 1. 为缺少关系说明的连线生成标注
    const unlabeled = allEdges.value.filter(e => !e.label && !e.isCategoryEdge).slice(0, 90);
    if (unlabeled.length > 0) {
      aiStatus.value = `正在标注 ${unlabeled.length} 条连线的关系...`;
      const result = await labelRelations(unlabeled.map(e => ({ a: e.a, b: e.b })));
      const validKeys = new Set(allEdges.value.map(e => e.a + '||' + e.b));
      for (const [key, label] of Object.entries(result)) {
        if (validKeys.has(key)) labels[key] = label;
      }
    }

    // 2. 检查新知识点与已有知识点的关联
    const hasNewNodes = force || allNodes.value.some(n => !known.has(n.name));
    if (hasNewNodes) {
      aiStatus.value = '正在发现知识点之间的新关联...';
      const nameSet = new Set(allNodes.value.map(n => n.name));
      const existingKeys = new Set(allEdges.value.map(e => [e.a, e.b].sort().join('||')));
      const suggestions = await suggestRelations(allNodes.value.map(n => n.name));
      for (const r of suggestions) {
        if (!nameSet.has(r.a) || !nameSet.has(r.b) || r.a === r.b) continue;
        const key = [r.a, r.b].sort().join('||');
        if (!existingKeys.has(key)) {
          newEdges.push({ a: r.a, b: r.b });
          existingKeys.add(key);
        }
        if (!labels[key]) labels[key] = r.label;
      }
    }

    if (Object.keys(labels).length > 0 || newEdges.length > 0 || hasNewNodes) {
      recordAIRelations({
        newEdges,
        labels,
        analyzedNodes: allNodes.value.map(n => n.name)
      });
      loadData(true);
    }
  } catch (e) {
    console.error('自动关联分析失败:', e);
  } finally {
    analyzing.value = false;
    aiStatus.value = '';
  }
}

onMounted(() => {
  loadData();
  autoLinkKnowledge();
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('click', closeContextMenu);
  document.addEventListener('keydown', onKeyDown);
});

onUnmounted(() => {
  stop();
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
  document.removeEventListener('click', closeContextMenu);
  document.removeEventListener('keydown', onKeyDown);
});
</script>
