<template>
  <Teleport to="body">
    <div class="kg-overlay" @click.self="$emit('close')">
      <div class="kg-modal pref-modal">
        <div class="kg-header">
          <h2>用户设置</h2>
          <button class="kg-close" @click="$emit('close')">×</button>
        </div>

        <div class="pref-body">
          <!-- 新闻来源 -->
          <button class="settings-section-header" @click="toggleSection('source')">
            <span>新闻来源</span>
            <span class="section-chevron">{{ openSections.source ? '▾' : '▸' }}</span>
          </button>
          <div v-if="openSections.source" class="settings-section-body">
            <div class="source-options">
              <button
                v-for="opt in sourceOptions"
                :key="opt.value"
                class="source-option"
                :class="{ active: newsSource === opt.value }"
                @click="chooseSource(opt.value)"
              >
                <span class="source-option-name">{{ opt.label }}</span>
                <span class="source-option-desc">{{ opt.desc }}</span>
              </button>
            </div>
            <p class="source-hint">切换后将在下次生成报告时生效</p>
          </div>

          <!-- 外观与提醒 -->
          <button class="settings-section-header" @click="toggleSection('appearance')">
            <span>外观与提醒</span>
            <span class="section-chevron">{{ openSections.appearance ? '▾' : '▸' }}</span>
          </button>
          <div v-if="openSections.appearance" class="settings-section-body">
            <div class="setting-row">
              <div class="setting-row-text">
                <span class="setting-row-name">深色模式</span>
                <span class="setting-row-desc">夜间使用更护眼</span>
              </div>
              <label class="switch">
                <input
                  id="setting-dark-mode"
                  name="darkMode"
                  type="checkbox"
                  :checked="darkMode"
                  @change="toggleDarkMode($event.target.checked)"
                >
                <span class="switch-slider"></span>
              </label>
            </div>
            <div class="setting-row">
              <div class="setting-row-text">
                <span class="setting-row-name">每日提醒</span>
                <span class="setting-row-desc">页面保持打开（可后台）时提醒生成报告</span>
              </div>
              <label class="switch">
                <input
                  id="setting-reminder"
                  name="reminderEnabled"
                  type="checkbox"
                  :checked="reminderEnabled"
                  @change="toggleReminder($event.target.checked)"
                >
                <span class="switch-slider"></span>
              </label>
            </div>
          </div>

          <!-- 新闻偏好 -->
          <button class="settings-section-header" @click="toggleSection('prefs')">
            <span>新闻偏好</span>
            <span class="section-chevron">{{ openSections.prefs ? '▾' : '▸' }}</span>
          </button>
          <div v-if="openSections.prefs" class="settings-section-body">
            <p class="pref-tip">
              自动学习：点击「确认本日」= 喜欢（+1），点击「生成今日报告」重新生成 = 不喜欢（-1）。
              生成报告时会优先选择你喜欢的类型；你也可以在下方手动调整。
            </p>

            <div class="pref-list">
              <div v-for="item in tagList" :key="item.name" class="pref-row">
                <span class="pref-name">{{ item.name }}</span>
                <div class="pref-weight-bar" :class="{ neg: item.weight < 0 }">
                  <div
                    class="pref-weight-fill"
                    :style="{ width: barWidth(item.weight) + '%' }"
                  ></div>
                </div>
                <span
                  class="pref-weight"
                  :class="{ 'pos': item.weight > 0, 'neg': item.weight < 0 }"
                >{{ item.weight > 0 ? '+' + item.weight : item.weight }}</span>
                <div class="pref-actions">
                  <button class="pref-btn" @click="change(item.name, 1)" title="权重 +1">+</button>
                  <button class="pref-btn" @click="change(item.name, -1)" title="权重 -1">−</button>
                  <button class="pref-btn" @click="zero(item.name)" title="权重清零">清零</button>
                  <button
                    v-if="item.custom"
                    class="pref-btn danger"
                    @click="remove(item.name)"
                    title="删除该自定义标签"
                  >删除</button>
                </div>
              </div>
            </div>

            <div class="pref-add">
              <input
                id="pref-new-tag"
                name="prefNewTag"
                autocomplete="off"
                v-model="newTag"
                type="text"
                placeholder="添加自定义关注方向，如：新能源、出海"
                maxlength="12"
                @keydown.enter="addTag"
              >
              <button class="kg-btn" :disabled="!newTag.trim()" @click="addTag">添加</button>
            </div>
          </div>

          <!-- 最近记录 -->
          <button class="settings-section-header" @click="toggleSection('history')">
            <span>最近记录</span>
            <span class="section-chevron">{{ openSections.history ? '▾' : '▸' }}</span>
          </button>
          <div v-if="openSections.history" class="settings-section-body">
            <div v-if="history.length === 0" class="pref-empty">暂无记录，锁定或重新生成报告后会自动记录</div>
            <div v-else class="pref-history">
              <div v-for="h in history" :key="h.ts" class="pref-history-item">
                <span
                  class="pref-history-action"
                  :class="{ 'pos': h.action === 'like', 'neg': h.action === 'dislike' }"
                >{{ h.action === 'like' ? '喜欢' : '不喜欢' }}</span>
                <span class="pref-history-title">{{ h.title }}</span>
                <span class="pref-history-tags">{{ (h.tags || []).join('、') }}</span>
              </div>
            </div>
          </div>

          <div class="pref-footer">
            <button class="kg-btn" @click="$emit('open-data')">数据管理</button>
            <button class="kg-btn" @click="resetAll">重置全部偏好</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { NEWS_TAGS, sortPreferenceTags } from '../utils/preferences';
import {
  getPreferences,
  adjustTagWeight,
  setTagWeight,
  removeTag as removeTagStorage,
  resetPreferences,
  getSettings,
  setSettings
} from '../storage';

defineEmits(['close', 'open-data', 'settings-changed']);

const prefs = ref(getPreferences());
const settings = ref(getSettings());
const newTag = ref('');
const openSections = reactive({ source: true, appearance: false, prefs: true, history: false });

const newsSource = computed(() => settings.value.newsSource);
const darkMode = computed(() => settings.value.darkMode);
const reminderEnabled = computed(() => settings.value.reminderEnabled);

const sourceOptions = [
  {
    value: 'international',
    label: '国外新闻',
    desc: 'Currents 全球源，话题面广；原文多为境外网站，可能无法直接访问'
  },
  {
    value: 'domestic',
    label: '国内新闻',
    desc: '华尔街见闻 / 中新网 / 人民网 / 钛媒体 / 爱范儿，原文国内可直接打开'
  }
];

function toggleSection(name) {
  openSections[name] = !openSections[name];
}

function chooseSource(value) {
  if (newsSource.value === value) return;
  settings.value = setSettings({ newsSource: value });
}

function toggleDarkMode(value) {
  settings.value = setSettings({ darkMode: !!value });
  document.documentElement.classList.toggle('dark', !!value);
}

function toggleReminder(value) {
  const enabled = !!value;
  if (enabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        settings.value = setSettings({ reminderEnabled: true });
        emitChanged();
      } else {
        alert('浏览器拒绝了通知权限，无法开启每日提醒');
      }
    });
    return;
  }
  settings.value = setSettings({ reminderEnabled: enabled });
  emitChanged();
}

function emitChanged() {
  window.dispatchEvent(new CustomEvent('settings-changed'));
}

function reload() {
  prefs.value = getPreferences();
}

// 展示全部固定标签 + 自定义标签
const tagList = computed(() => {
  const weights = prefs.value.tags || {};
  const names = new Set([...NEWS_TAGS, ...Object.keys(weights)]);
  const merged = {};
  for (const name of names) merged[name] = weights[name] || 0;

  return sortPreferenceTags(merged, NEWS_TAGS).map(name => ({
    name,
    weight: merged[name],
    custom: !NEWS_TAGS.includes(name)
  }));
});

const maxAbsWeight = computed(() => {
  let max = 1;
  for (const item of tagList.value) {
    max = Math.max(max, Math.abs(item.weight));
  }
  return max;
});

function barWidth(weight) {
  const abs = Math.abs(weight);
  if (abs === 0) return 0;
  return Math.max(8, Math.round((abs / maxAbsWeight.value) * 100));
}

const history = computed(() => (prefs.value.history || []).slice(0, 20));

function change(tag, delta) {
  adjustTagWeight(tag, delta);
  reload();
}

function zero(tag) {
  setTagWeight(tag, 0);
  reload();
}

function remove(tag) {
  removeTagStorage(tag);
  reload();
}

function addTag() {
  const name = newTag.value.trim();
  if (!name) return;
  adjustTagWeight(name, 1);
  newTag.value = '';
  reload();
}

function resetAll() {
  if (confirm('确定清除所有偏好权重和学习记录吗？')) {
    resetPreferences();
    reload();
  }
}
</script>
