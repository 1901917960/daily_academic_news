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
    <button @click="showData = true" title="存储占用、清理、备份与恢复">数据</button>
  </div>
</header>

      <div v-if="preferenceSummary" class="pref-bar">
        <span class="pref-label">偏好学习</span>
        <span class="pref-text">{{ preferenceSummary }}</span>
        <button class="pref-reset" @click="showPrefs = true">管理</button>
      </div>

      <div v-if="loading" class="loading">
        <div class="loading-step">{{ step }}</div>
        <div class="loading-hint">已用时 {{ elapsed }} 秒，请保持页面打开</div>
      </div>

      <div v-else-if="error" class="error">{{ error }}</div>

      <div v-if="allDates.length > 0" class="date-bar">
        <span class="date-bar-label">报告日期：</span>
        <button
          v-for="d in allDates"
          :key="d"
          :class="['date-btn', { active: d === selectedDate }]"
          @click="selectedDate = d"
        >
          {{ d === todayKey ? '今天' : d }}
        </button>
      </div>

      <ReportView
        v-if="currentRecord"
        :news="currentRecord.news"
        :analysis="currentRecord.analysis"
      />
      <div v-else-if="!loading && !error" class="empty">
        还没有任何报告，点击右上角生成
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

    <PreferencePanel v-if="showPrefs" @close="closePrefs" />
    <DataPanel v-if="showData" @close="showData = false" />
  </div>
</template>

<script setup>
import { extractKnowledgePoints } from './api/extract';
import { saveKnowledgeForDate, isLocked, setLocked } from './storage';
import { ref, computed, onMounted, onUnmounted } from 'vue';
import ReportView from './components/ReportView.vue';
import ChatBox from './components/ChatBox.vue';
import PreferencePanel from './components/PreferencePanel.vue';
import DataPanel from './components/DataPanel.vue';
import { fetchDailyNews } from './api/news';
import { analyzeNews } from './api/analyze';
import {
  getTodayKey, getRecord, saveRecord, getAllRecords,
  getPreferences, recordPreference, retractPreference, cleanupStorage
} from './storage';

const loading = ref(false);
const error = ref('');
const step = ref('');
const elapsed = ref(0);
let elapsedTimer = null;
const todayKey = getTodayKey();
const allRecords = ref([]);
const selectedDate = ref(todayKey);
const locked = ref(false);
const prefs = ref(getPreferences());
const showPrefs = ref(false);
const showData = ref(false);

function refreshPrefs() {
  prefs.value = getPreferences();
}

function closePrefs() {
  showPrefs.value = false;
  refreshPrefs();
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

function startProgress(initialStep) {
  step.value = initialStep;
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

    startProgress('正在抓取今日新闻…');
    const news = await fetchDailyNews();
    step.value = '正在生成财经分析（约 20-40 秒）…';
    const analysis = await analyzeNews(news);
    step.value = '正在保存报告…';
    saveRecord(todayKey, news, analysis);
    refreshData();
    selectedDate.value = todayKey;
    saved = { news, analysis };
  } catch (e) {
    console.error('生成失败:', e);
    // 根据错误类型提供更友好的提示
    if (e.message.includes('apiKey') || e.message.includes('API key') || e.message.includes('401')) {
      error.value = '请在 .env 文件中配置有效的 DeepSeek API Key';
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

onMounted(() => {
  // 启动时自动清理超期数据，避免长期使用撑爆本地存储
  cleanupStorage();
  refreshData();
  refreshLock();
  const existing = getRecord(todayKey);
  if (existing) {
    const dates = getAllRecords().map(r => r.date).sort().reverse();
    selectedDate.value = dates[0] || todayKey;
  } else if (!isLocked(todayKey)) {
    generate();
  }
});

onUnmounted(() => {
  stopProgress();
});
</script>