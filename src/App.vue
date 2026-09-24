<template>
  <div class="app-layout">
    <!-- 左侧：主内容 -->
    <main class="main-content">
      <header>
        <h1>📰 每日学术洞察</h1>
        <div class="header-actions">
          <button
            @click="toggleLock"
            :class="['lock-btn', { 'lock-active': locked }]"
            :disabled="!todayRecord"
          >
            {{ locked ? '🔓 撤销确认' : '🔒 确认本日' }}
          </button>
          <button @click="generate" :disabled="loading || locked">
            {{ loading ? '分析中...' : '生成今日报告' }}
          </button>
          <button @click="showSettings = true" title="新闻来源、新闻偏好、数据管理">设置</button>
        </div>
      </header>

      <div v-if="preferenceSummary" class="pref-bar">
        <span class="pref-label">偏好学习</span>
        <span class="pref-text">{{ preferenceSummary }}</span>
      </div>

      <div v-if="loading" class="loading">
        <div class="steps">
          <div
            v-for="(s, i) in steps"
            :key="s.label"
            class="step-item"
            :class="{ active: stepIndex === i, done: stepIndex > i }"
          >
            <span class="step-dot">{{ stepIndex > i ? '✓' : i + 1 }}</span>
            <span class="step-label">{{ s.label }}</span>
          </div>
        </div>
        <div class="loading-hint">已用时 {{ elapsed }} 秒，请保持页面打开</div>
      </div>

      <div v-else-if="error" class="error">{{ error }}</div>

      <div v-if="libraryStats.reports > 0 || libraryStats.knowledge > 0" class="stats-strip">
        <span class="stats-item">{{ libraryStats.reports }} 天报告</span>
        <span class="stats-item">{{ libraryStats.knowledge }} 个知识点</span>
        <span class="stats-item">{{ libraryStats.chatNodes }} 轮对话</span>
      </div>

      <div v-if="allDates.length > 0" class="date-bar">
        <span class="date-bar-label">报告日期：</span>
        <DatePicker
          :selected-date="selectedDate"
          :available-dates="allDates"
          @select="selectedDate = $event"
        />
        <button
          v-if="allRecords.length >= 2"
          class="date-btn weekly-btn"
          @click="showWeekly = true"
        >周报</button>
      </div>

      <ReportView
        v-if="currentRecord"
        :news="currentRecord.news"
        :analysis="currentRecord.analysis"
      />
      <div v-else-if="!loading && !error" class="empty">
        <svg class="empty-illustration" viewBox="0 0 120 90" fill="none" aria-hidden="true">
          <rect x="14" y="12" width="92" height="66" rx="8" stroke="#cbd5e1" stroke-width="2.5"/>
          <line x1="26" y1="30" x2="94" y2="30" stroke="#cbd5e1" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="26" y1="42" x2="82" y2="42" stroke="#e2e8f0" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="26" y1="54" x2="70" y2="54" stroke="#e2e8f0" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="60" cy="70" r="4" fill="#cbd5e1"/>
          <circle cx="72" cy="70" r="4" fill="#e2e8f0"/>
          <circle cx="84" cy="70" r="4" fill="#e2e8f0"/>
        </svg>
        <p>还没有任何报告</p>
        <p class="empty-sub">点击右上角「生成今日报告」，AI 会为你挑选今日最值得分析的财经新闻</p>
      </div>
    </main>

    <!-- 右侧：固定侧边栏 -->
    <aside class="sidebar">
      <ChatBox
        v-if="currentRecord"
        :news="currentRecord.news"
        :analysis="currentRecord.analysis"
        :date-key="selectedDate"
      />
      <div v-else class="sidebar-empty">
        生成报告后可使用学术问答
      </div>
    </aside>

    <SettingsPanel v-if="showSettings" @close="closeSettings" @open-data="openData" />
    <DataPanel v-if="showData" @close="showData = false" />
    <AccessCodeModal v-if="showAccessCode" @close="showAccessCode = false" />
    <WeeklyPanel v-if="showWeekly" :records="allRecords" @close="showWeekly = false" />
  </div>
</template>

<script setup>
import { extractKnowledgePoints } from './api/extract';
import { saveKnowledgeForDate, isLocked, setLocked } from './storage';
import { ref, computed, onMounted, onUnmounted } from 'vue';
import ReportView from './components/ReportView.vue';
import ChatBox from './components/ChatBox.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import DataPanel from './components/DataPanel.vue';
import AccessCodeModal from './components/AccessCodeModal.vue';
import WeeklyPanel from './components/WeeklyPanel.vue';
import DatePicker from './components/DatePicker.vue';
import { fetchDailyNews } from './api/news';
import { analyzeNews } from './api/analyze';
import { getAccessCode } from './api/client';
import {
  getTodayKey, getRecord, saveRecord, getAllRecords,
  getPreferences, recordPreference, retractPreference, cleanupStorage,
  getSettings, getAllKnowledge, countChatTreeNodes
} from './storage';

const loading = ref(false);
const error = ref('');
const stepIndex = ref(0);
const elapsed = ref(0);
let elapsedTimer = null;
const todayKey = getTodayKey();
const allRecords = ref([]);
const selectedDate = ref(todayKey);
const locked = ref(false);
const prefs = ref(getPreferences());
const showSettings = ref(false);
const showData = ref(false);
const showAccessCode = ref(false);
const showWeekly = ref(false);
const libraryStats = ref({ reports: 0, knowledge: 0, edges: 0, chatNodes: 0 });
let reminderTimer = null;

const steps = [
  { label: '抓取今日新闻' },
  { label: '财经分析与文献' },
  { label: '保存报告' }
];

function refreshPrefs() {
  prefs.value = getPreferences();
}

function refreshStats() {
  const kg = getAllKnowledge();
  const chat = countChatTreeNodes();
  libraryStats.value = {
    reports: allRecords.value.length,
    knowledge: kg.nodes.length,
    edges: kg.edges.length,
    chatNodes: chat.nodes
  };
}

function closeSettings() {
  showSettings.value = false;
  refreshPrefs();
}

function openData() {
  showSettings.value = false;
  refreshPrefs();
  showData.value = true;
}

// 偏好摘要：展示权重最高的喜欢/不喜欢类型
const preferenceSummary = computed(() => {
  const entries = Object.entries(prefs.value.tags || {});
  if (entries.length === 0) return '';
  const liked = entries
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([tag, w]) => `${tag} +${w}`);
  const disliked = entries
    .filter(([, w]) => w < 0)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 4)
    .map(([tag, w]) => `${tag} ${w}`);
  return [...liked, ...disliked].join(' · ');
});

function startProgress(initialStepIndex) {
  stepIndex.value = initialStepIndex;
  elapsed.value = 0;
  clearInterval(elapsedTimer);
  elapsedTimer = setInterval(() => { elapsed.value++; }, 1000);
}

function stopProgress() {
  clearInterval(elapsedTimer);
  elapsedTimer = null;
}

function refreshLock() {
  locked.value = isLocked(todayKey);
}

function toggleLock() {
  const next = !locked.value;
  setLocked(todayKey, next);

  const record = getRecord(todayKey);
  if (record?.news?.tags?.length) {
    if (next) {
      // 锁定本日视为"喜欢"信号，记录当前新闻的类型偏好
      recordPreference(record.news.tags, 1, {
        title: record.news.title,
        date: todayKey
      });
    } else {
      // 撤销锁定：撤回之前的"喜欢"信号
      retractPreference(record.news.tags, {
        title: record.news.title,
        date: todayKey
      });
    }
    refreshPrefs();
  }

  refreshLock();
}

const allDates = computed(() =>
  allRecords.value.map(r => r.date).sort().reverse()
);

const currentRecord = computed(() =>
  allRecords.value.find(r => r.date === selectedDate.value) || null
);

const todayRecord = computed(() =>
  allRecords.value.find(r => r.date === todayKey) || null
);

function refreshData() {
  allRecords.value = getAllRecords();
  refreshStats();
}

async function generate() {
  if (locked.value) {
    alert('本日新闻已确认。如需重新生成，请先点击「撤销确认」。');
    return;
  }
  loading.value = true;
  error.value = '';
  let saved = null;
  try {
    // 重新生成视为对当前新闻的"不喜欢"信号
    const existing = getRecord(todayKey);
    if (existing?.news?.tags?.length) {
      recordPreference(existing.news.tags, -1, {
        title: existing.news.title,
        date: todayKey
      });
      refreshPrefs();
    }

    startProgress(0);
    const news = await fetchDailyNews();
    stepIndex.value = 1;
    const analysis = await analyzeNews(news);
    stepIndex.value = 2;
    saveRecord(todayKey, news, analysis);
    refreshData();
    selectedDate.value = todayKey;
    saved = { news, analysis };
  } catch (e) {
    console.error('生成失败:', e);
    // 根据错误类型提供更友好的提示
    if (e.message.includes('apiKey') || e.message.includes('API key') || e.message.includes('401')) {
      error.value = '访问码无效或 API 配置错误，请检查后重试';
    } else if (e.message.includes('网络') || e.message.includes('fetch') || e.message.includes('Failed to fetch')) {
      error.value = '网络连接失败，请检查网络状态后重试';
    } else if (e.message.includes('新闻')) {
      error.value = e.message + '。请稍后重试';
    } else {
      error.value = '生成失败：' + e.message + '。请稍后重试';
    }
  } finally {
    loading.value = false;
    stopProgress();
  }

  // 后台提取知识点
  if (saved) {
    extractKnowledgePoints(saved)
      .then(points => {
        if (points && points.length > 0) {
          saveKnowledgeForDate(todayKey, points);
        }
      })
      .catch(e => console.error('知识点提取失败', e));
  }
}

/* ---------- 访问码弹窗 ---------- */
function onAccessCodeRequired() {
  if (!import.meta.env.DEV) {
    showAccessCode.value = true;
  }
}

/* ---------- 深色模式 ---------- */
function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', !!dark);
}

/* ---------- 每日提醒 ---------- */
function checkReminder() {
  if (!getSettings().reminderEnabled) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (getRecord(todayKey)) return; // 已有今日报告
  const hour = new Date().getHours();
  if (hour < 7 || hour > 22) return;
  try {
    new Notification('每日学术洞察', { body: '今天的报告还没有生成，来看看今日值得分析的财经新闻吧' });
  } catch { /* ignore */ }
}

function setupReminder() {
  clearInterval(reminderTimer);
  if (getSettings().reminderEnabled) {
    checkReminder();
    reminderTimer = setInterval(checkReminder, 30 * 60 * 1000);
  }
}

onMounted(() => {
  // 启动时自动清理超期数据，避免长期使用撑爆本地存储
  cleanupStorage();
  applyTheme(getSettings().darkMode);
  refreshData();
  refreshLock();

  // 部署环境无访问码时弹出输入框
  if (!import.meta.env.DEV && !getAccessCode()) {
    showAccessCode.value = true;
  }
  window.addEventListener('access-code-required', onAccessCodeRequired);
  window.addEventListener('settings-changed', onSettingsChanged);

  setupReminder();

  const existing = getRecord(todayKey);
  if (existing) {
    const dates = getAllRecords().map(r => r.date).sort().reverse();
    selectedDate.value = dates[0] || todayKey;
  } else if (!isLocked(todayKey)) {
    generate();
  }
});

function onSettingsChanged() {
  applyTheme(getSettings().darkMode);
  setupReminder();
}

onUnmounted(() => {
  stopProgress();
  clearInterval(reminderTimer);
  window.removeEventListener('access-code-required', onAccessCodeRequired);
  window.removeEventListener('settings-changed', onSettingsChanged);
});
</script>
