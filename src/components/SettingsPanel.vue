<template>
  <Teleport to="body">
    <div class="kg-overlay" @click.self="$emit('close')">
      <div class="kg-modal pref-modal">
        <div class="kg-header">
          <h2>用户设置</h2>
          <button class="kg-close" @click="$emit('close')">×</button>
        </div>

        <div class="pref-body">
          <div class="pref-section-title">新闻来源</div>
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

          <div class="pref-section-title">新闻偏好</div>
          <p class="pref-tip">
            自动学习：点击「确认本日」= 喜欢（+1），点击「生成今日报告」重新生成 = 不喜欢（-1）。
            生成报告时会优先选择你喜欢的类型；你也可以在下方手动调整。
          </p>

          <div class="pref-list">
            <div v-for="item in tagList" :key="item.name" class="pref-row">
              <span class="pref-name">{{ item.name }}</span>
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
              v-model="newTag"
              type="text"
              placeholder="添加自定义关注方向，如：新能源、出海"
              maxlength="12"
              @keydown.enter="addTag"
            >
            <button class="kg-btn" :disabled="!newTag.trim()" @click="addTag">添加</button>
          </div>

          <div class="pref-section-title">最近记录</div>
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
import { ref, computed } from 'vue';
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

defineEmits(['close', 'open-data']);

const prefs = ref(getPreferences());
const newsSource = ref(getSettings().newsSource);
const newTag = ref('');

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

function chooseSource(value) {
  if (newsSource.value === value) return;
  newsSource.value = value;
  setSettings({ newsSource: value });
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
