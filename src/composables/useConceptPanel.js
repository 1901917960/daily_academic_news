import { ref, watch } from 'vue';
import { getConcept, saveConcept } from '../storage';
import { fetchConcept, fetchPlainExplanation } from '../api/concepts';

// 知识点概念面板：学术概念 + 可展开的通俗解释
export function useConceptPanel(selected) {
  const conceptInfo = ref(null);      // { concept, plain }
  const conceptLoading = ref(false);
  const conceptError = ref('');
  const plainOpen = ref(false);
  const plainLoading = ref(false);
  let conceptReqId = 0;
  let plainReqId = 0;

  // 加载知识点的学术概念（优先读取缓存）
  async function loadConceptFor(node) {
    const reqId = ++conceptReqId;
    plainReqId++;
    conceptError.value = '';
    plainOpen.value = false;
    conceptInfo.value = null;

    const cached = getConcept(node.name);
    if (cached && cached.concept) {
      conceptInfo.value = cached;
      return;
    }

    conceptLoading.value = true;
    try {
      const concept = await fetchConcept(node.name, node.category);
      if (reqId !== conceptReqId) return;
      conceptInfo.value = { concept };
      saveConcept(node.name, { concept });
    } catch (e) {
      if (reqId !== conceptReqId) return;
      console.error('获取概念失败:', e);
      conceptError.value = '获取概念失败';
    } finally {
      if (reqId === conceptReqId) conceptLoading.value = false;
    }
  }

  function retryConcept() {
    if (selected.value) loadConceptFor(selected.value);
  }

  // 展开/收起通俗解释（首次展开时生成并缓存）
  async function togglePlain() {
    if (plainOpen.value) {
      plainOpen.value = false;
      return;
    }

    plainOpen.value = true;
    const name = selected.value?.name;
    if (!name) return;

    const cached = getConcept(name);
    if (cached && cached.plain) {
      conceptInfo.value = { ...(conceptInfo.value || {}), plain: cached.plain };
      return;
    }

    const reqId = ++plainReqId;
    plainLoading.value = true;
    try {
      const plain = await fetchPlainExplanation(name, conceptInfo.value?.concept || '');
      if (reqId !== plainReqId) return;
      conceptInfo.value = { ...(conceptInfo.value || {}), plain };
      saveConcept(name, { plain });
    } catch (e) {
      if (reqId !== plainReqId) return;
      console.error('生成通俗解释失败:', e);
    } finally {
      if (reqId === plainReqId) plainLoading.value = false;
    }
  }

  // 选中节点变化时加载概念
  watch(() => selected.value?.name, (name) => {
    if (name) {
      loadConceptFor(selected.value);
    } else {
      conceptReqId++;
      plainReqId++;
      conceptInfo.value = null;
      conceptError.value = '';
      plainOpen.value = false;
      conceptLoading.value = false;
      plainLoading.value = false;
    }
  });

  return {
    conceptInfo,
    conceptLoading,
    conceptError,
    plainOpen,
    plainLoading,
    retryConcept,
    togglePlain
  };
}
