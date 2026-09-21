import { describe, it, expect } from 'vitest';
import { parseJsonLoose } from '../json';

describe('parseJsonLoose', () => {
  it('解析标准 JSON 对象', () => {
    expect(parseJsonLoose('{"a": 1}')).toEqual({ a: 1 });
  });

  it('去除 markdown 代码块围栏', () => {
    expect(parseJsonLoose('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(parseJsonLoose('```\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it('截取前后有杂质的内容', () => {
    expect(parseJsonLoose('好的，以下是结果：{"a": 1} 希望有帮助')).toEqual({ a: 1 });
  });

  it('解析数组', () => {
    expect(parseJsonLoose('[1, 2, 3]')).toEqual([1, 2, 3]);
    expect(parseJsonLoose('结果如下 [{"x": 1}] 完毕')).toEqual([{ x: 1 }]);
  });

  it('嵌套对象截取正确', () => {
    const text = '前言 {"a": {"b": [1,2]}, "c": "}"} 后记';
    expect(parseJsonLoose(text)).toEqual({ a: { b: [1, 2] }, c: '}' });
  });

  it('无效输入返回 null', () => {
    expect(parseJsonLoose('')).toBeNull();
    expect(parseJsonLoose('不是 JSON')).toBeNull();
    expect(parseJsonLoose(null)).toBeNull();
    expect(parseJsonLoose(undefined)).toBeNull();
    expect(parseJsonLoose(123)).toBeNull();
  });
});
