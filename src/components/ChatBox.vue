<template>
  <div class="chat-box">
    <div class="chat-header">
      <span>💬 学术问答助手</span>
      <div class="header-actions">
        <button
          v-if="navTree.length > 0"
          class="nav-btn"
          @click="showNav = !showNav"
        >
          📋 目录
        </button>
        <button class="nav-btn" @click="showKG = true">
          🧠 思维库
        </button>
        <button
          class="clear-btn"
          v-if="Object.keys(nodes).length > 0"
          @click="clear"
        >
          清空
        </button>
      </div>
    </div>

    <!-- 目录树 -->
    <div v-if="showNav && navTree.length > 0" class="nav-panel">
      <div class="nav-list">
        <NavTreeItem
          v-for="item in annotatedTree"
          :key="item.node.id"
          :item="item"
          :active-path-ids="activePathIds"
          @select="selectNode"
        />
      </div>
    </div>

    <div class="chat-body">
      <div ref="msgList" class="chat-messages">
        <div v-if="currentPath.length === 0" class="chat-hint">
          你可以问我：<br>
          · 这个方向可以用什么理论框架？<br>
          · 有没有相关的中文顶刊文献？<br>
          · 如果要做实证研究，数据从哪来？<br>
          <br>
          💡 <b>在 AI 回答或新闻分析中选中文字</b> → 弹出「追问」按钮 → 针对该内容继续深挖。
        </div>

        <div
          v-for="node in currentPath"
          :key="node.id"
          :data-node-id="node.id"
          class="chat-exchange"
        >
          <div class="msg user">
            <div class="msg-content">
              <div v-if="node.quote" class="inline-quote">
                <span class="inline-quote-label">📌 追问自</span>
                <span class="inline-quote-text">{{ node.quote.text }}</span>
              </div>
              <div class="question-text">{{ node.question }}</div>
            </div>
          </div>
          <div v-if="node.error" class="msg assistant msg-error">
            <div class="msg-content">{{ node.error }}</div>
            <button class="retry-btn" @click="retryNode(node.id)">重试</button>
          </div>
          <div v-else-if="node.answer" class="msg assistant">
            <div
              class="msg-content markdown-body"
              :class="{ 'answer-clamped': isCollapsed(node) }"
              v-html="htmlCache[node.id]?.html || ''"
            ></div>
            <button
              v-if="isLongAnswer(node)"
              class="collapse-toggle"
              @click="toggleCollapse(node.id)"
            >{{ isCollapsed(node) ? '展开全文' : '收起' }}</button>
          </div>
          <div v-else class="msg assistant">
            <div class="msg-content typing">思考中...</div>
          </div>
        </div>
      </div>

      <!-- 待发送的引用 -->
      <div v-if="pendingQuote" class="quote-preview">
        <div class="quote-head">
          <span>📌 追问引用</span>
          <button class="quote-close" @click="pendingQuote = null">×</button>
        </div>
        <div class="quote-text">{{ pendingQuote.text }}</div>
      </div>

      <div class="chat-input-row">
        <textarea
          id="chat-input"
          name="chatInput"
          autocomplete="off"
          v-model="input"
          :placeholder="pendingQuote ? '输入你的追问（可留空，直接点发送让AI展开）' : '输入问题，Enter 发送'"
          :disabled="sending"
          @keydown.enter.exact.prevent="send"
        ></textarea>
        <button
          :disabled="sending || (!input.trim() && !pendingQuote)"
          @click="send"
        >
          发送
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showQuoteBtn"
        class="quote-btn"
        :style="{ top: quotePos.top + 'px', left: quotePos.left + 'px' }"
        @mousedown.prevent="applyQuote"
      >
        💬 追问
      </div>
    </Teleport>

    <KnowledgeGraph v-if="showKG" @close="showKG = false" />
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted, defineAsyncComponent } from 'vue';
import { streamChatWithContext, extractKnowledgeFromChat } from '../api/chat';
import { renderMarkdown } from '../utils/markdown';
import { getChatTree, saveChatTree, saveChatKnowledgeForDate } from '../storage';
import NavTreeItem from './NavTreeItem.vue';

// 思维库按需加载，减小首屏体积
const KnowledgeGraph = defineAsyncComponent(() => import('./KnowledgeGraph.vue'));

const props = defineProps({
  news: Object,
  analysis: Object,
  dateKey: String
});

/* ---------- 状态 ---------- */
const nodes = ref({});       // { id: { id, parentId, question, answer, quote, createdAt } }
const activeId = ref(null);  // 当前活跃节点
const input = ref('');
const sending = ref(false);
const msgList = ref(null);
const showNav = ref(false);
const showKG = ref(false);
const pendingQuote = ref(null);  // { text, fromNodeId }

// 选中浮动按钮
const showQuoteBtn = ref(false);
const quotePos = ref({ top: 0, left: 0 });
const rawSelection = ref({ text: '', nodeId: '' });

// 长回答折叠状态
const collapsedAnswers = ref(new Set());

const LONG_ANSWER_CHARS = 800;

function isLongAnswer(node) {
  return !!node.answer && node.answer.length > LONG_ANSWER_CHARS;
}

function isCollapsed(node) {
  return collapsedAnswers.value.has(node.id);
}

function toggleCollapse(nodeId) {
  const next = new Set(collapsedAnswers.value);
  if (next.has(nodeId)) next.delete(nodeId);
  else next.add(nodeId);
  collapsedAnswers.value = next;
}

// 回答的渲染缓存：{ [nodeId]: { src, html } }（不持久化，避免存储膨胀）
const htmlCache = ref({});

async function renderAnswer(node) {
  if (!node || !node.answer) return;
  const cached = htmlCache.value[node.id];
  if (cached && cached.src === node.answer) return;
  const html = await renderMarkdown(node.answer);
  htmlCache.value = { ...htmlCache.value, [node.id]: { src: node.answer, html } };
}

/* ---------- 计算属性 ---------- */
// 从根到 activeId 的路径
const currentPath = computed(() => {
  if (!activeId.value) return [];
  const path = [];
  let id = activeId.value;
  const guard = new Set();
  while (id && nodes.value[id] && !guard.has(id)) {
    guard.add(id);
    path.unshift(nodes.value[id]);
    id = nodes.value[id].parentId;
  }
  return path;
});

// 当前路径包含的所有节点 id
const activePathIds = computed(() =>
  new Set(currentPath.value.map(n => n.id))
);

// 整棵目录树（嵌套）
const navTree = computed(() => {
  const build = (parentId) =>
    Object.values(nodes.value)
      .filter(n => n.parentId === parentId)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(n => ({ node: n, children: build(n.id) }));
  return build(null);
});

// 给目录树加序号：1 → 1.1 → 1.1.1
const annotatedTree = computed(() => annotate(navTree.value));

function annotate(tree, prefix = '') {
  return tree.map((item, i) => {
    const num = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
    return {
      num,
      node: item.node,
      children: annotate(item.children, num)
    };
  });
}

/* ---------- 日期切换 ---------- */
watch(() => props.dateKey, (key) => {
  if (!key) return;
  const tree = getChatTree(key);
  nodes.value = tree.nodes || {};
  activeId.value = tree.activeId || null;
  pendingQuote.value = null;
  showNav.value = false;
  nextTick(scrollToBottom);
}, { immediate: true });

// 路径变化时渲染回答（覆盖流式更新的增量渲染）
watch(currentPath, (path) => {
  for (const node of path) renderAnswer(node);
}, { immediate: true });

/* ---------- 持久化 ---------- */
function persist() {
  if (props.dateKey) {
    saveChatTree(props.dateKey, {
      nodes: nodes.value,
      activeId: activeId.value
    });
  }
}

/* ---------- 工具 ---------- */
function newId() {
  return 'n_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function getPath(nodeId) {
  const path = [];
  let id = nodeId;
  const guard = new Set();
  while (id && nodes.value[id] && !guard.has(id)) {
    guard.add(id);
    path.unshift(nodes.value[id]);
    id = nodes.value[id].parentId;
  }
  return path;
}

async function scrollToBottom() {
  await nextTick();
  if (msgList.value) msgList.value.scrollTop = msgList.value.scrollHeight;
}

/* ---------- 发送 ---------- */
async function send() {
  if (sending.value) return;

  const hasQuote = !!pendingQuote.value;
  const rawQ = input.value.trim();
  if (!rawQ && !hasQuote) return;

  const finalQuestion = rawQ || '请就这段内容展开分析：其中的学术含义、可研究的问题、可能的方法和数据来源。';

  // 父节点：
  //   - 从 chat 消息追问 → 挂到那条节点下（精确分叉）
  //   - 从新闻/分析追问 → 挂到当前活跃节点下（或作为根）
  //   - 普通发送 → 挂到当前活跃节点下
  const parentId =
    hasQuote && pendingQuote.value.fromNodeId
      ? pendingQuote.value.fromNodeId
      : activeId.value;

  const quoteInfo = hasQuote
    ? {
        text: pendingQuote.value.text,
        fromNodeId: pendingQuote.value.fromNodeId || null
      }
    : null;

  const nodeId = newId();
  const newNode = {
    id: nodeId,
    parentId: parentId || null,
    question: finalQuestion,
    answer: '',
    quote: quoteInfo,
    createdAt: Date.now()
  };

  nodes.value = { ...nodes.value, [nodeId]: newNode };
  activeId.value = nodeId;
  input.value = '';
  pendingQuote.value = null;
  sending.value = true;
  scrollToBottom();

  await runNode(nodeId);
}

// 执行某个节点的问答（流式输出、错误处理），可被重试复用
async function runNode(nodeId) {
  const node = nodes.value[nodeId];
  if (!node) return;

  const parentId = node.parentId;
  const pathToParent = parentId ? getPath(parentId) : [];
  const history = [];
  for (const n of pathToParent) {
    history.push({ role: 'user', content: n.question });
    if (n.answer) history.push({ role: 'assistant', content: n.answer });
  }

  const questionForApi = node.quote
    ? `【用户引用的原文】\n"${node.quote.text}"\n\n【用户的问题】\n${node.question}`
    : node.question;

  try {
    const stream = streamChatWithContext({
      news: props.news,
      analysis: props.analysis,
      history,
      question: questionForApi
    });

    let reply = '';
    for await (const delta of stream) {
      reply += delta;
      nodes.value = {
        ...nodes.value,
        [nodeId]: { ...nodes.value[nodeId], answer: reply }
      };
      scrollToBottom();
    }

    if (!reply) throw new Error('未收到回答内容');
    nodes.value = {
      ...nodes.value,
      [nodeId]: { ...nodes.value[nodeId], answer: reply, error: '' }
    };
    persist();

    // 后台提取对话中的知识点并保存（不阻塞对话）
    extractKnowledgeFromChat(reply)
      .then(points => {
        if (points.length > 0 && props.dateKey) {
          saveChatKnowledgeForDate(props.dateKey, points);
        }
      })
      .catch(error => console.error('提取知识点失败:', error));
  } catch (e) {
    console.error('问答失败:', e);
    nodes.value = {
      ...nodes.value,
      [nodeId]: { ...nodes.value[nodeId], error: e.message || '出错了，请重试' }
    };
    persist();
  } finally {
    sending.value = false;
    scrollToBottom();
  }
}

// 重试失败的回答
async function retryNode(nodeId) {
  if (sending.value) return;
  nodes.value = {
    ...nodes.value,
    [nodeId]: { ...nodes.value[nodeId], answer: '', error: '' }
  };
  sending.value = true;
  await runNode(nodeId);
}

/* ---------- 目录交互 ---------- */
function selectNode(id) {
  activeId.value = id;
  showNav.value = false;
  persist();
  scrollToBottom();
}

function clear() {
  if (confirm('清空当前日期的所有对话？此操作不可恢复。')) {
    nodes.value = {};
    activeId.value = null;
    pendingQuote.value = null;
    showNav.value = false;
    persist();
  }
}

/* ---------- 选中文字 ---------- */
function handleMouseUp(e) {
  // 忽略输入区和目录区的选中
  if (e.target.closest('.chat-input-row')) return;
  if (e.target.closest('.nav-panel')) return;
  if (e.target.closest('.quote-btn')) return;

  const sel = window.getSelection();
  const text = sel ? sel.toString().trim() : '';
  if (!text || text.length < 2) {
    showQuoteBtn.value = false;
    return;
  }

  try {
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    let el = range.commonAncestorContainer;
    if (el.nodeType !== 1) el = el.parentElement;

    const nodeEl = el.closest('[data-node-id]');
    const inMainContent = el.closest('.main-content') !== null;

    if (nodeEl) {
      // 来自 chat 里的 AI 回答 → 记录节点 id，精确分叉
      rawSelection.value = { text, nodeId: nodeEl.dataset.nodeId };
    } else if (inMainContent) {
      // 来自新闻 / 分析报告 → nodeId 为 null
      rawSelection.value = { text, nodeId: null };
    } else {
      showQuoteBtn.value = false;
      return;
    }

    quotePos.value = {
      top: Math.max(rect.top - 44, 8),
      left: Math.min(
        Math.max(rect.left + rect.width / 2, 60),
        window.innerWidth - 60
      )
    };
    showQuoteBtn.value = true;
  } catch (err) {
    showQuoteBtn.value = false;
  }
}

function applyQuote() {
  pendingQuote.value = {
    text: rawSelection.value.text,
    fromNodeId: rawSelection.value.nodeId
  };
  showQuoteBtn.value = false;
  window.getSelection()?.removeAllRanges();
  nextTick(() => {
    document.querySelector('.chat-input-row textarea')?.focus();
  });
}

/* ---------- 生命周期 ---------- */
function onDocMouseDown(e) {
  if (!e.target.closest('.quote-btn')) showQuoteBtn.value = false;
  if (showNav.value && !e.target.closest('.nav-panel') && !e.target.closest('.nav-btn')) {
    showNav.value = false;
  }
}

onMounted(() => {
  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('mousedown', onDocMouseDown);
});

onUnmounted(() => {
  document.removeEventListener('mouseup', handleMouseUp);
  document.removeEventListener('mousedown', onDocMouseDown);
});
</script>