import { describe, it, expect } from 'vitest';
import { parseRssFeed, cleanRssText, RSS_SOURCES } from '../rss';

const RSS_SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>测试财经新闻</title>
    <item>
      <title><![CDATA[某公司宣布重大重组计划]]></title>
      <link>https://example.com/news/1</link>
      <description><![CDATA[<p>公司今日公告称，将进行业务重组，涉及多个部门。</p>]]></description>
      <pubDate>Tue, 22 Sep 2026 06:00:00 +0800</pubDate>
      <dc:creator>测试媒体</dc:creator>
    </item>
    <item>
      <title>消费市场出现新趋势 &amp; 新变化</title>
      <link>https://example.com/news/2</link>
      <description>消费者偏好正在改变 &lt;重要&gt;</description>
      <pubDate>Mon, 21 Sep 2026 10:30:00 +0800</pubDate>
    </item>
    <item>
      <title>没有链接的新闻</title>
      <description>描述</description>
    </item>
  </channel>
</rss>`;

const ATOM_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom 测试源</title>
  <entry>
    <title>科技公司发布新产品</title>
    <link rel="alternate" href="https://example.com/atom/1"/>
    <summary>新产品面向消费市场</summary>
    <published>2026-09-22T08:00:00Z</published>
  </entry>
</feed>`;

describe('parseRssFeed', () => {
  it('解析 RSS 2.0：标题、链接、描述、时间', () => {
    const items = parseRssFeed(RSS_SAMPLE);
    expect(items.length).toBe(3);
    expect(items[0].title).toBe('某公司宣布重大重组计划');
    expect(items[0].url).toBe('https://example.com/news/1');
    expect(items[0].description).toBe('公司今日公告称，将进行业务重组，涉及多个部门。');
    expect(items[0].author).toBe('测试媒体');
    expect(items[0].published).toMatch(/^2026-09-2\d /);
  });

  it('解码 HTML 实体', () => {
    const items = parseRssFeed(RSS_SAMPLE);
    expect(items[1].title).toBe('消费市场出现新趋势 & 新变化');
    expect(items[1].description).toBe('消费者偏好正在改变 <重要>');
  });

  it('解析 Atom 格式', () => {
    const items = parseRssFeed(ATOM_SAMPLE);
    expect(items.length).toBe(1);
    expect(items[0].title).toBe('科技公司发布新产品');
    expect(items[0].url).toBe('https://example.com/atom/1');
    expect(items[0].description).toBe('新产品面向消费市场');
  });

  it('缺少标题的条目被跳过', () => {
    const xml = '<rss><channel><item><link>https://x.com</link></item></channel></rss>';
    expect(parseRssFeed(xml)).toEqual([]);
  });

  it('空输入返回空数组', () => {
    expect(parseRssFeed('')).toEqual([]);
    expect(parseRssFeed(null)).toEqual([]);
    expect(parseRssFeed('<html>不是订阅源</html>')).toEqual([]);
  });

  it('长描述被截断', () => {
    const longDesc = '很长的描述'.repeat(100);
    const xml = `<rss><channel><item><title>T</title><description>${longDesc}</description></item></channel></rss>`;
    const items = parseRssFeed(xml);
    expect(items[0].description.length).toBeLessThanOrEqual(201);
    expect(items[0].description.endsWith('…')).toBe(true);
  });

  it('限制条目数量', () => {
    const items = Array.from({ length: 50 }, (_, i) =>
      `<item><title>新闻${i}</title></item>`
    ).join('');
    const xml = `<rss><channel>${items}</channel></rss>`;
    expect(parseRssFeed(xml, { maxItems: 10 }).length).toBe(10);
  });

  it('无效时间返回空字符串', () => {
    const xml = '<rss><channel><item><title>T</title><pubDate>not-a-date</pubDate></item></channel></rss>';
    expect(parseRssFeed(xml)[0].published).toBe('');
  });

  it('提取 enclosure 配图', () => {
    const xml = '<rss><channel><item><title>T</title><enclosure url="https://example.com/img.jpg" type="image/jpeg"/></item></channel></rss>';
    expect(parseRssFeed(xml)[0].image).toBe('https://example.com/img.jpg');
  });

  it('提取 media:content 配图', () => {
    const xml = '<rss><channel><item><title>T</title><media:content url="https://example.com/m.jpg" type="image/jpeg"/></item></channel></rss>';
    expect(parseRssFeed(xml)[0].image).toBe('https://example.com/m.jpg');
  });

  it('无配图返回空字符串', () => {
    const xml = '<rss><channel><item><title>T</title></item></channel></rss>';
    expect(parseRssFeed(xml)[0].image).toBe('');
  });
});

describe('cleanRssText', () => {
  it('去除 CDATA 与 HTML 标签', () => {
    expect(cleanRssText('<![CDATA[<b>加粗</b>内容]]>')).toBe('加粗 内容');
  });

  it('解码数字实体', () => {
    expect(cleanRssText('价格 &#165;100')).toBe('价格 ¥100');
  });

  it('压缩空白', () => {
    expect(cleanRssText('  多个   空格\n换行  ')).toBe('多个 空格 换行');
  });
});

describe('RSS_SOURCES', () => {
  it('每个源都有 key、label、url', () => {
    expect(RSS_SOURCES.length).toBeGreaterThanOrEqual(3);
    for (const src of RSS_SOURCES) {
      expect(src.key).toBeTruthy();
      expect(src.label).toBeTruthy();
      expect(src.url).toMatch(/^https?:\/\//);
    }
  });

  it('key 不重复', () => {
    const keys = RSS_SOURCES.map(s => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
