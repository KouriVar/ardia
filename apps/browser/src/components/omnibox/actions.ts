import type { CommandAction } from "@ardia/core";
import type { BrowserCommand } from "@ardia/shell";
import { runCommand } from "../../lib/commands";
import { isBookmarked } from "../../store/bookmarks";
import { useBrowser, type BrowserState } from "../../store/browser";
import { activeTab, bookmarkProfileId, isPinnedRow } from "../../store/model";
import type { Tab } from "../../store/types";

type Context = { s: BrowserState; windowId: string; tab: Tab | undefined };

type ActionDef = {
  command: BrowserCommand;
  arg?: string;
  title: string | ((c: Context) => string);
  icon: string;
  hint?: string;
  keywords?: string[];
  needs?: "page" | "tab" | "profiles";
};

const page = "page" as const;

const DEFS: ActionDef[] = [
  { command: "newTab", title: "新建标签页", icon: "plus", hint: "⌘T", keywords: ["open tab"] },
  { command: "newWindow", title: "新建窗口", icon: "macwindow", hint: "⌘N" },
  { command: "newIncognitoWindow", title: "新建无痕窗口", icon: "eyeglasses", hint: "⇧⌘N", keywords: ["private window", "incognito"] },
  { command: "closeTab", title: "关闭标签页", icon: "xmark", hint: "⌘W", needs: "tab" },
  { command: "closeAllTabs", title: "关闭所有标签页", icon: "xmark.square", hint: "⇧⌘K", keywords: ["clear unpinned tabs", "close unpinned tabs", "clear today"] },
  { command: "reopenClosedTab", title: "重新打开关闭的标签页", icon: "arrow.uturn.backward", hint: "⇧⌘T", keywords: ["undo close", "restore tab"] },
  {
    command: "togglePin",
    title: ({ tab }) => (isPinnedRow(tab) ? "取消固定标签页" : tab?.pinned ? "从顶部应用取消固定" : "移到顶部应用"),
    icon: "pin",
    keywords: ["pin", "unpin", "pin tab", "unpin tab", "remove from top apps", "favorites"],
    needs: "tab",
  },
  {
    command: "togglePin",
    arg: "row",
    title: ({ s, tab }) => (isPinnedRow(tab) ? "移到顶部应用" : `移到 ${s.profiles[tab?.profileId ?? ""]?.name ?? "个人资料"} 的固定标签页`),
    icon: "list.bullet",
    keywords: ["pin", "pinned tabs", "pin as row", "move to pinned", "favorites"],
    needs: "tab",
  },
  { command: "duplicateTab", title: "创建标签页副本", icon: "plus.square.on.square", needs: "tab" },
  { command: "renameTab", title: "重命名标签页", icon: "pencil", needs: "tab" },
  { command: "searchTabs", title: "搜索标签页", icon: "magnifyingglass", hint: "⇧⌘A" },
  { command: "cleanUpTabs", title: "清理标签页", icon: "sparkles", hint: "⌥⌘K", keywords: ["tidy tabs"] },
  { command: "newGroupWithTabs", title: "将标签页加入新分组", icon: "folder.badge.plus", hint: "⌃⌘N", keywords: ["tab group"], needs: "tab" },
  { command: "reload", title: "重新加载页面", icon: "arrow.clockwise", hint: "⌘R", keywords: ["refresh"], needs: page },
  { command: "forceReload", title: "强制重新加载页面", icon: "arrow.clockwise", hint: "⇧⌘R", keywords: ["hard reload", "hard refresh"], needs: page },
  { command: "toggleMute", title: ({ tab }) => (tab?.muted ? "取消网站静音" : "将网站静音"), icon: "speaker.slash", keywords: ["mute", "unmute", "silence"], needs: page },
  { command: "copyUrl", title: "复制网址", icon: "link", hint: "⇧⌘C", keywords: ["copy link"], needs: page },
  { command: "copyUrlAsMarkdown", title: "将网址复制为 Markdown", icon: "link", hint: "⌥⇧⌘C", keywords: ["markdown link"], needs: page },
  { command: "findInPage", title: "在页面中查找", icon: "text.magnifyingglass", hint: "⌘F", needs: page },
  {
    command: "bookmarkPage",
    title: ({ s, windowId, tab }) =>
      tab?.url && isBookmarked(s.bookmarks, bookmarkProfileId(s, s.windows[windowId]), tab.url) ? "移除书签" : "将此页面加入书签",
    icon: "bookmark",
    hint: "⌘D",
    keywords: ["add bookmark", "bookmark"],
    needs: page,
  },
  { command: "print", title: "打印", icon: "printer", hint: "⌘P", needs: page },
  { command: "share", title: "分享", icon: "square.and.arrow.up", keywords: ["airdrop", "share link", "send link"], needs: page },
  { command: "zoomIn", title: "放大", icon: "plus.magnifyingglass", hint: "⌘+", needs: page },
  { command: "zoomOut", title: "缩小", icon: "minus.magnifyingglass", hint: "⌘-", needs: page },
  { command: "zoomReset", title: "实际大小", icon: "1.magnifyingglass", hint: "⌘0", keywords: ["reset zoom"], needs: page },
  { command: "devTools", title: "开发者工具", icon: "hammer", hint: "⌥⌘I", keywords: ["inspect", "devtools", "console"], needs: page },
  { command: "toggleFullUrl", title: ({ s }) => (s.settings.showFullUrl ? "隐藏完整网址" : "显示完整网址"), icon: "text.alignleft" },
  { command: "toggleSidebar", title: "自动隐藏标签页", icon: "sidebar.left", hint: "⌘S", keywords: ["toggle sidebar", "hide sidebar", "show sidebar", "focus mode"] },
  { command: "toggleBookmarksBar", title: "切换书签栏显示", icon: "menubar.rectangle", hint: "⇧⌘B", keywords: ["bookmarks bar"] },
  { command: "downloads", title: "下载内容", icon: "arrow.down.circle", hint: "⇧⌘J", keywords: ["show downloads", "dl"] },
  { command: "showHistory", title: "历史记录", icon: "clock", hint: "⌘Y", keywords: ["show history"] },
  { command: "manageBookmarks", title: "书签", icon: "book", hint: "⌥⌘B", keywords: ["manage bookmarks", "show bookmarks"] },
  { command: "openSettings", title: "设置", icon: "gearshape", hint: "⌘,", keywords: ["preferences", "prefs", "options"] },
  { command: "clearBrowsingData", title: "清除浏览数据", icon: "trash", keywords: ["clear history", "clear cache", "clear cookies"] },
  { command: "importBrowserData", title: "导入浏览器数据", icon: "square.and.arrow.down", keywords: ["import bookmarks", "import passwords"] },
  { command: "keyboardShortcuts", title: "键盘快捷键", icon: "keyboard", keywords: ["shortcuts", "hotkeys"] },
  { command: "mergeAllWindows", title: "合并所有窗口", icon: "rectangle.stack", needs: "profiles" },
  { command: "newProfile", title: "新建个人资料", icon: "person.crop.circle.badge.plus", keywords: ["create profile"], needs: "profiles" },
  { command: "setAppearance", arg: "dark", title: "深色外观", icon: "moon", keywords: ["dark mode"] },
  { command: "setAppearance", arg: "light", title: "浅色外观", icon: "sun.max", keywords: ["light mode"] },
  { command: "setAppearance", arg: "auto", title: "使用系统外观", icon: "circle.lefthalf.filled", keywords: ["auto appearance", "system appearance"] },
];

const actionId = (d: Pick<ActionDef, "command" | "arg">) => (d.arg ? `${d.command}:${d.arg}` : d.command);

export function barActions(s: BrowserState, windowId: string): CommandAction[] {
  const w = s.windows[windowId];
  const tab = activeTab(s, windowId);
  const c: Context = { s, windowId, tab };
  const out: CommandAction[] = [];
  for (const d of DEFS) {
    if (d.needs === "page" && !tab?.url) continue;
    if (d.needs === "tab" && !tab) continue;
    if (d.needs === "profiles" && w?.incognito) continue;
    out.push({
      id: actionId(d),
      title: typeof d.title === "string" ? d.title : d.title(c),
      icon: d.icon,
      ...(d.hint ? { hint: d.hint } : {}),
      ...(d.keywords ? { keywords: d.keywords } : {}),
    });
  }
  if (w && !w.incognito) {
    s.profileOrder.forEach((id, i) => {
      if (id === w.profileId) return;
      const name = s.profiles[id]?.name ?? "";
      out.push({ id: `switchProfile:${id}`, title: `切换到 ${name}`, icon: "person.crop.circle", hint: i < 9 ? `⌃${i + 1}` : undefined, keywords: [name, "profile"] });
    });
  }
  return out;
}

export function runBarAction(id: string, windowId: string) {
  const i = id.indexOf(":");
  const command = (i < 0 ? id : id.slice(0, i)) as BrowserCommand;
  const arg = i < 0 ? null : id.slice(i + 1);
  runCommand({ command, arg, windowId });
}

const barActionsOf = new WeakMap<BrowserState, Map<string, CommandAction[]>>();

export function currentBarActions(windowId: string): CommandAction[] {
  const s = useBrowser.getState();
  let byWindow = barActionsOf.get(s);
  if (!byWindow) barActionsOf.set(s, (byWindow = new Map()));
  let actions = byWindow.get(windowId);
  if (!actions) byWindow.set(windowId, (actions = barActions(s, windowId)));
  return actions;
}
