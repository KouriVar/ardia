import { launchEnvironment, readDocument, systemInfo, writeDocument } from "@ardia/shell";
import { create } from "zustand";

export type ReleaseNotes = {
  version: string;
  date: string;
  title: string;
  summary: string;
  items: { title: string; body: string }[];
};

const RELEASE_NOTES: ReleaseNotes[] = [
  {
    version: "1.0",
    date: "2026 年 9 月",
    title: "你好，Ardia",
    summary: "首个版本：安静、快速的浏览器，让标签页、网页和注意力各归其位。",
    items: [
      { title: "一个命令栏，处理所有操作", body: "在新标签页中搜索、输入网址或跳转到已打开的标签页，也可在任何页面按 ⌘L 打开命令栏。" },
      { title: "分屏视图", body: "将标签页拖到页面上，即可将两到三个页面并排、上下或分列显示。" },
      { title: "标签页分组和固定标签页", body: "将相关标签页分组，固定常用页面，再用“清理标签页”整理其余页面。" },
      { title: "不挡视线的画中画", body: "将视频放在屏幕边缘；点击网站名称即可返回标签页。" },
      { title: "带上你的一切", body: "从 Chrome、Safari、Arc 等浏览器导入书签、历史记录、密码和已打开的标签页。" },
      { title: "各具主题颜色的个人资料", body: "将工作和个人生活分开，每个个人资料都可在新标签页中设置独立主题。" },
    ],
  },
];

const POSTCARD_SECONDS = 86_400;

const DOC = "release-notes.json";
type Saved = { version: 1; lastVersion: string; pending: { version: string; since: number } | null };

function readSaved(): Saved | null {
  try {
    const json = readDocument(DOC);
    return json ? (JSON.parse(json) as Saved) : null;
  } catch {
    return null;
  }
}

function save(saved: Omit<Saved, "version">) {
  try {
    writeDocument(DOC, JSON.stringify({ version: 1, ...saved } satisfies Saved));
  } catch (error) {
    console.warn("无法保存更新说明状态", error);
  }
}

const notesFor = (version: string) => RELEASE_NOTES.find((n) => n.version === version) ?? null;

type State = {
  pending: Saved["pending"];
  page: { windowId: string; version: string } | null;
};

const useReleaseNotes = create<State>(() => ({ pending: null, page: null }));

export function trackAppVersion(): boolean {
  const version = systemInfo().appVersion;
  if (!version) return false;
  const saved = readSaved();
  const updated = saved ? saved.lastVersion !== version : !!readDocument("session.json");
  let pending = saved?.pending ?? null;
  if (__DEV__) {
    if (launchEnvironment("ARDIA_WHATS_NEW") === "1") pending = { version, since: Date.now() };
  } else if (updated) {
    pending = notesFor(version) ? { version, since: Date.now() } : null;
  }
  if (pending && Date.now() - pending.since > POSTCARD_SECONDS * 1000) pending = null;
  save({ lastVersion: version, pending });
  useReleaseNotes.setState({ pending });
  return updated;
}

export function usePendingReleaseNotes(): ReleaseNotes | null {
  const version = useReleaseNotes((s) => s.pending?.version);
  return version ? notesFor(version) : null;
}

export function useReleaseNotesPage(windowId: string): ReleaseNotes | null {
  const version = useReleaseNotes((s) => (s.page?.windowId === windowId ? s.page.version : undefined));
  return version ? notesFor(version) : null;
}

export function openReleaseNotes(windowId: string, version = useReleaseNotes.getState().pending?.version ?? systemInfo().appVersion) {
  if (!notesFor(version)) return;
  retireReleaseNotes();
  useReleaseNotes.setState({ page: { windowId, version } });
}

export const closeReleaseNotes = () => useReleaseNotes.setState({ page: null });

export function retireReleaseNotes() {
  if (!useReleaseNotes.getState().pending) return;
  useReleaseNotes.setState({ pending: null });
  save({ lastVersion: readSaved()?.lastVersion ?? systemInfo().appVersion, pending: null });
}

function queueReleaseNotes(version = systemInfo().appVersion) {
  const pending = notesFor(version) ? { version, since: Date.now() } : null;
  useReleaseNotes.setState({ pending });
  save({ lastVersion: systemInfo().appVersion, pending });
}

if (__DEV__) (globalThis as { acReleaseNotes?: unknown }).acReleaseNotes = { store: useReleaseNotes, queue: queueReleaseNotes, retire: retireReleaseNotes, open: openReleaseNotes };
