<template>
  <Teleport to="body">
    <div class="kg-overlay" @click.self="$emit('close')">
      <div class="kg-modal review-modal">
        <div class="kg-header">
          <h2>知识点复习</h2>
          <button class="kg-close" @click="$emit('close')">×</button>
        </div>

        <div class="pref-body">
          <div v-if="loading" class="review-loading">正在准备复习卡片…</div>

          <template v-else-if="queue.length > 0">
            <div class="review-progress">
              今日待复习 {{ queue.length }} 个（已复习 {{ reviewedCount }}）
            </div>

            <div class="review-card">
              <div class="review-card-name">{{ current.name }}</div>
              <div class="review-card-cat">{{ current.category }}</div>

              <div v-if="revealed" class="review-concept">
                <div v-if="conceptLoading" class="kg-concept-muted">正在获取概念…</div>
                <div v-else-if="currentConcept" class="review-concept-text">{{ currentConcept }}</div>
                <div v-else class="kg-concept-muted">暂未缓存概念，可先回忆再评分</div>
              </div>
              <button v-else class="kg-btn" @click="reveal">显示概念</button>

              <div class="review-actions">
                <button class="review-btn unknown" @click="rate('unknown')">不认识</button>
                <button class="review-btn fuzzy" @click="rate('fuzzy')">模糊</button>
                <button class="review-btn known" @click="rate('known')">认识</button>
              </div>
            </div>

            <div class="review-skip">
              <button class="kg-btn" @click="skip">跳过</button>
            </div>
          </template>

          <template v-else>
            <div class="review-done">
              <div class="review-done-icon">✓</div>
              <p>今日复习已完成</p>
              <p class="review-done-sub">没有到期的知识点，明天再来看看吧</p>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { getAllKnowledge, getReviewState, recordReview, getConcept } from '../storage';
import { nextReviewSchedule, dueKnowledgePoints } from '../utils/review';
import { fetchConcept } from '../api/concepts';

defineEmits(['close']);

const queue = ref([]);
const reviewedCount = ref(0);
const revealed = ref(false);
const conceptLoading = ref(false);
const currentConcept = ref('');
const loading = ref(true);

const current = computed(() => queue.value[0] || null);

onMounted(() => {
  const kg = getAllKnowledge();
  const state = getReviewState();
  const due = dueKnowledgePoints(kg.nodes.map(n => n.name), state);
  queue.value = due.slice(0, 30);
  loading.value = false;
});

async function reveal() {
  revealed.value = true;
  const name = current.value?.name;
  if (!name) return;

  const cached = getConcept(name);
  if (cached && cached.concept) {
    currentConcept.value = cached.concept;
    return;
  }

  conceptLoading.value = true;
  try {
    const concept = await fetchConcept(name, current.value.category);
    currentConcept.value = concept;
  } catch (e) {
    console.error('获取概念失败:', e);
  } finally {
    conceptLoading.value = false;
  }
}

function rate(rating) {
  const name = current.value?.name;
  if (!name) return;
  const schedule = nextReviewSchedule(rating, getReviewState()[name]);
  recordReview(name, rating, schedule);
  reviewedCount.value++;
  nextCard();
}

function skip() {
  nextCard();
}

function nextCard() {
  queue.value = queue.value.slice(1);
  revealed.value = false;
  currentConcept.value = '';
}
</script>
