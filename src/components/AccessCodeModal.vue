<template>
  <Teleport to="body">
    <div class="kg-overlay" @click.self="onCancel">
      <div class="kg-modal access-modal">
        <div class="kg-header">
          <h2>输入访问码</h2>
        </div>
        <div class="access-body">
          <p class="access-tip">
            本网站由朋友分享，AI 与新闻接口需要访问码才能使用。<br>
            请向网站所有者（分享给你的人）获取访问码。
          </p>
          <input
            id="access-code-input"
            name="accessCode"
            type="password"
            autocomplete="off"
            v-model="code"
            placeholder="请输入访问码"
            @keydown.enter="onSubmit"
          >
          <p v-if="error" class="access-error">{{ error }}</p>
          <div class="access-actions">
            <button class="kg-btn" @click="onCancel">取消</button>
            <button class="kg-btn kg-btn-primary" :disabled="!code.trim()" @click="onSubmit">确定</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { submitAccessCode, cancelAccessCode } from '../api/client';

const emit = defineEmits(['close']);

const code = ref('');
const error = ref('');

onMounted(() => {
  nextTick(() => {
    const input = document.getElementById('access-code-input');
    if (input) input.focus();
  });
});

function onSubmit() {
  const value = code.value.trim();
  if (!value) return;
  if (submitAccessCode(value)) {
    code.value = '';
    error.value = '';
    emit('close');
  } else {
    error.value = '保存失败，请重试';
  }
}

function onCancel() {
  cancelAccessCode();
  code.value = '';
  error.value = '';
  emit('close');
}
</script>
