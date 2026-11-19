import assert from "node:assert/strict";
import { test } from "node:test";
import { translate, translatorFor } from "./translate.ts";
import { zhHans } from "./zhHans/index.ts";

test("missing translation falls back to the English source", () => {
  assert.equal(translate("Some unknown string", "zh-Hans"), "Some unknown string");
  assert.equal(translate("Default browser", "en"), "Default browser");
});

test("known string translates in zh-Hans", () => {
  assert.equal(translate("Default browser", "zh-Hans"), "默认浏览器");
});

test("placeholders are interpolated in both languages", () => {
  assert.equal(translate("Last checked {date}.", "zh-Hans", { date: "today" }), "上次检查时间：today。");
  assert.equal(translate("Nothing matches “{query}”.", "zh-Hans", { query: "x" }), "没有与“x”匹配的内容。");
  assert.equal(translate("Last checked {date}.", "en", { date: "today" }), "Last checked today.");
});

test("translatorFor binds the language", () => {
  const t = translatorFor("zh-Hans");
  assert.equal(t("Search"), "搜索");
  assert.equal(t("Unknown"), "Unknown");
});

test("every translation keeps the source's placeholders", () => {
  const keys = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  const wrong = Object.entries(zhHans).filter(([source, translated]) => {
    const before = keys(source);
    const after = keys(translated);
    return before.length !== after.length || before.some((key, index) => key !== after[index]);
  });
  assert.deepEqual(wrong, []);
});
