import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as storage from '../storage';

const store = {};
vi.stubGlobal('localStorage', {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
});

function dateKey(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
});

describe('cleanupStorage', () => {
  it('清理废弃的旧数据键', () => {
    store['daily_academic_chat'] = '[]';
    store['daily_academic_used_topics'] = '["x"]';
    const removed = storage.cleanupStorage();
    expect(removed.legacy).toBe(2);
    expect(store['daily_academic_chat']).toBeUndefined();
    expect(store['daily_academic_used_topics']).toBeUndefined();
  });

  it('对话记录保留 90 天内、清理超期数据', () => {
    const old = dateKey(120);
    const recent = dateKey(10);
    store['daily_academic_chat_tree_v2'] = JSON.stringify({
      [old]: { nodes: {} },
      [recent]: { nodes: {} }
    });

    const removed = storage.cleanupStorage();
    expect(removed.chats).toBe(1);

    const trees = JSON.parse(store['daily_academic_chat_tree_v2']);
    expect(trees[old]).toBeUndefined();
    expect(trees[recent]).toBeDefined();
  });

  it('报告超过 30 天时裁剪旧记录', () => {
    const records = {};
    for (let i = 0; i < 35; i++) records[dateKey(i)] = { news: {}, analysis: {} };
    store['daily_academic_news'] = JSON.stringify(records);

    const removed = storage.cleanupStorage();
    expect(removed.reports).toBe(5);
    expect(Object.keys(JSON.parse(store['daily_academic_news'])).length).toBe(30);
  });

  it('锁定记录清理超期数据', () => {
    store['daily_academic_lock'] = JSON.stringify({
      [dateKey(120)]: true,
      [dateKey(5)]: true
    });
    const removed = storage.cleanupStorage();
    expect(removed.locks).toBe(1);
    expect(storage.isLocked(dateKey(5))).toBe(true);
    expect(storage.isLocked(dateKey(120))).toBe(false);
  });

  it('概念缓存清理已删除知识点的条目', () => {
    storage.saveKnowledgeForDate(dateKey(0), [{ name: '双重差分法', category: '研究方法' }]);
    store['daily_academic_kg_concepts'] = JSON.stringify({
      '双重差分法': { concept: 'x', updatedAt: 1 },
      '已删除的知识点': { concept: 'y', updatedAt: 2 }
    });

    const removed = storage.cleanupStorage();
    expect(removed.concepts).toBe(1);

    const cache = JSON.parse(store['daily_academic_kg_concepts']);
    expect(cache['双重差分法']).toBeDefined();
    expect(cache['已删除的知识点']).toBeUndefined();
  });

  it('概念缓存超过 500 条时保留最近更新的', () => {
    const points = [];
    const cache = {};
    for (let i = 0; i < 510; i++) {
      points.push({ name: `知识点${i}`, category: '核心概念' });
      cache[`知识点${i}`] = { concept: 'x', updatedAt: i };
    }
    storage.saveKnowledgeForDate(dateKey(0), points);
    store['daily_academic_kg_concepts'] = JSON.stringify(cache);

    const removed = storage.cleanupStorage();
    expect(removed.concepts).toBe(10);

    const kept = JSON.parse(store['daily_academic_kg_concepts']);
    expect(Object.keys(kept).length).toBe(500);
    expect(kept['知识点0']).toBeUndefined();
    expect(kept['知识点509']).toBeDefined();
  });

  it('AI 关联清理引用已删除知识点的数据', () => {
    storage.saveKnowledgeForDate(dateKey(0), [{ name: '双重差分法', category: '研究方法' }]);
    store['daily_academic_kg_ai'] = JSON.stringify({
      labels: {
        '双重差分法||已删除': 'x',
        '双重差分法||双重差分法': 'y'
      },
      edges: [
        { a: '双重差分法', b: '已删除' },
        { a: '双重差分法', b: '双重差分法' }
      ],
      analyzedNodes: ['双重差分法', '已删除']
    });

    storage.cleanupStorage();

    const ai = JSON.parse(store['daily_academic_kg_ai']);
    expect(ai.labels['双重差分法||已删除']).toBeUndefined();
    expect(ai.labels['双重差分法||双重差分法']).toBe('y');
    expect(ai.edges.length).toBe(1);
    expect(ai.analyzedNodes).toEqual(['双重差分法']);
  });
});

describe('exportAllData / importAllData', () => {
  it('导出后导入可完整还原', () => {
    storage.saveKnowledgeForDate('2026-09-20', [{ name: '事件研究法', category: '研究方法' }]);
    storage.recordPreference(['公司治理'], 1, { title: '测试新闻', date: '2026-09-20' });

    const payload = storage.exportAllData();
    expect(payload.app).toBe('daily-academic-news');
    expect(payload.version).toBe(1);

    for (const k of Object.keys(store)) delete store[k];
    const count = storage.importAllData(payload);
    expect(count).toBeGreaterThan(0);

    expect(storage.getKnowledgeBase()['2026-09-20'][0].name).toBe('事件研究法');
    expect(storage.getPreferences().tags['公司治理']).toBe(1);
    expect(storage.getPreferences().history.length).toBe(1);
  });

  it('拒绝非本应用格式的备份', () => {
    expect(() => storage.importAllData(null)).toThrow();
    expect(() => storage.importAllData({ app: 'other', data: {} })).toThrow();
    expect(() => storage.importAllData({ app: 'daily-academic-news' })).toThrow();
  });

  it('忽略未知键，防止注入其他数据', () => {
    storage.importAllData({
      app: 'daily-academic-news',
      data: {
        evil_key: { x: 1 },
        daily_academic_prefs: { tags: { A: 1 }, history: [] }
      }
    });
    expect(store['evil_key']).toBeUndefined();
    expect(storage.getPreferences().tags.A).toBe(1);
  });
});
