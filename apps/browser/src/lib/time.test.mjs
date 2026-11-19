import assert from "node:assert/strict";
import { test } from "node:test";
const { ago, durationMinutes, durationParts, durationTitle, MAX_DURATION_MINUTES } = await import("./time.ts");
const { setActiveLanguage } = await import("./i18n/active.ts");

test("relative times read in English without Intl.RelativeTimeFormat", () => {
  const now = 1_000_000_000_000;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  assert.equal(ago(now - 10_000, now), "just now");
  assert.equal(ago(now - minute, now), "1 minute ago");
  assert.equal(ago(now - 59 * minute, now), "59 minutes ago");
  assert.equal(ago(now - hour, now), "1 hour ago");
  assert.equal(ago(now - 23 * hour, now), "23 hours ago");
  assert.equal(ago(now - day, now), "yesterday");
  assert.equal(ago(now - 2 * day, now), "2 days ago");
  assert.equal(ago(now - 7 * day, now), "1 week ago");
  assert.equal(ago(now - 14 * day, now), "2 weeks ago");
  assert.equal(ago(now - 30 * day, now), "1 month ago");
  assert.equal(ago(now - 60 * day, now), "2 months ago");
  assert.equal(ago(now - 365 * day, now), "1 year ago");
  assert.equal(ago(now - 730 * day, now), "2 years ago");
});

test("relative times never need Intl.RelativeTimeFormat, which Hermes lacks", () => {
  const saved = Intl.RelativeTimeFormat;
  delete Intl.RelativeTimeFormat;
  try {
    assert.equal(ago(1_000_000_000_000 - 60_000, 1_000_000_000_000), "1 minute ago");
    assert.equal(ago(1_000_000_000_000 - 86_400_000, 1_000_000_000_000), "yesterday");
  } finally {
    Intl.RelativeTimeFormat = saved;
  }
});

test("relative times read in Chinese", () => {
  const now = 1_000_000_000_000;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  setActiveLanguage("zh-Hans");
  try {
    assert.equal(ago(now - 10_000, now), "刚刚");
    assert.equal(ago(now - minute, now), "1 分钟前");
    assert.equal(ago(now - 17 * minute, now), "17 分钟前");
    assert.equal(ago(now - hour, now), "1 小时前");
    assert.equal(ago(now - 23 * hour, now), "23 小时前");
    assert.equal(ago(now - day, now), "昨天");
    assert.equal(ago(now - 3 * day, now), "3 天前");
    assert.equal(ago(now - 7 * day, now), "1 周前");
    assert.equal(ago(now - 14 * day, now), "2 周前");
    assert.equal(ago(now - 30 * day, now), "1 个月前");
    assert.equal(ago(now - 60 * day, now), "2 个月前");
    assert.equal(ago(now - 365 * day, now), "1 年前");
    assert.equal(ago(now - 730 * day, now), "2 年前");
  } finally {
    setActiveLanguage("en");
  }
});

test("a duration in minutes reads in the largest unit that holds it exactly", () => {
  for (const [minutes, amount, unit] of [[30, 30, "minutes"], [90, 90, "minutes"], [60, 1, "hours"], [36 * 60, 36, "hours"], [1440, 1, "days"], [7 * 1440, 7, "days"]]) {
    assert.deepEqual(durationParts(minutes), { amount, unit });
  }
});

test("duration titles say one minute, hour or day in the singular", () => {
  for (const [minutes, title] of [[1, "1 minute"], [45, "45 minutes"], [60, "1 hour"], [720, "12 hours"], [1440, "1 day"], [2880, "2 days"], [43200, "30 days"]]) {
    assert.equal(durationTitle(minutes), title);
  }
});

test("a typed amount becomes whole minutes, and nothing at or below zero or past a year counts", () => {
  assert.equal(durationMinutes("30", "minutes"), 30);
  assert.equal(durationMinutes(" 2 ", "hours"), 120);
  assert.equal(durationMinutes("1.5", "hours"), 90);
  assert.equal(durationMinutes("3", "days"), 3 * 1440);
  assert.equal(durationMinutes("365", "days"), MAX_DURATION_MINUTES);
  for (const [amount, unit] of [["0", "minutes"], ["0.2", "minutes"], ["-5", "minutes"], ["", "hours"], ["abc", "days"], ["1e3", "minutes"], ["366", "days"]]) {
    assert.equal(durationMinutes(amount, unit), null, `${amount} ${unit}`);
  }
});
