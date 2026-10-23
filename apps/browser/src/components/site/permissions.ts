import { onPermission, onPermissionDismissed, resolvePermission, type PermissionKind, type PermissionRequest, type PermissionResult } from "@ardia/ardiacore";
import { ensureNotificationPermission } from "../../lib/webNotifications";
import { useBrowser } from "../../store/browser";
import { patchPage, pageOf, tabForBrowser, usePages } from "../layout/pageState";
import { startDeviceChoosers } from "./DeviceChooser";

const queues = new Map<string, PermissionRequest[]>();
const orphans: PermissionRequest[] = [];
let started = false;

export function startPermissionPrompts() {
  if (started) return;
  started = true;
  startDeviceChoosers();
  onPermission((request) => {
    const tabId = tabForBrowser(request.browserId);
    if (!tabId) {
      orphans.push(request);
      return;
    }
    enqueue(tabId, request);
  });
  onPermissionDismissed(({ id }) => drop(id));
  usePages.subscribe((s, prev) => {
    if (s.browsers === prev.browsers || !orphans.length) return;
    for (const request of orphans.splice(0)) {
      const tabId = tabForBrowser(request.browserId);
      if (tabId) enqueue(tabId, request);
    }
  });
}

function enqueue(tabId: string, request: PermissionRequest) {
  if (!pageOf(tabId).permission) patchPage(tabId, { permission: request });
  else queues.set(tabId, [...(queues.get(tabId) ?? []), request]);
}

function next(tabId: string) {
  const queue = queues.get(tabId) ?? [];
  patchPage(tabId, { permission: queue.shift() ?? null });
  if (queue.length) queues.set(tabId, queue);
  else queues.delete(tabId);
}

function drop(id: string) {
  for (const [tabId, page] of Object.entries(usePages.getState().pages)) {
    if (page.permission?.id === id) next(tabId);
  }
  for (const [tabId, queue] of queues) queues.set(tabId, queue.filter((r) => r.id !== id));
}

export function answerPermission(tabId: string, requestId: string, result: PermissionResult) {
  const request = pageOf(tabId).permission;
  if (!request || request.id !== requestId) return;
  void resolvePermission(request.id, result, result !== "dismiss");
  if (result === "accept" && request.permissions.includes("notifications")) {
    void ensureNotificationPermission(useBrowser.getState().tabs[tabId]?.windowId);
  }
  next(tabId);
}

export function dismissPermissions(tabId: string) {
  for (const r of queues.get(tabId) ?? []) void resolvePermission(r.id, "dismiss");
  queues.delete(tabId);
  const current = pageOf(tabId).permission;
  if (current) {
    void resolvePermission(current.id, "dismiss");
    patchPage(tabId, { permission: null });
  }
}

type Describe = { icon: string; noun?: string; question?: (site: string) => string };

const KINDS: Record<PermissionKind, Describe> = {
  camera: { icon: "video", noun: "摄像头" },
  microphone: { icon: "mic", noun: "麦克风" },
  cameraPanTiltZoom: { icon: "video", noun: "摄像头平移、俯仰和缩放" },
  screen: { icon: "rectangle.on.rectangle", question: (s) => `允许 ${s} 共享你的屏幕？` },
  location: { icon: "location", noun: "位置" },
  notifications: { icon: "bell", question: (s) => `允许 ${s} 发送通知？` },
  clipboard: { icon: "doc.on.clipboard", noun: "剪贴板" },
  midi: { icon: "pianokeys", noun: "MIDI 设备" },
  multipleDownloads: { icon: "arrow.down.circle", question: (s) => `允许 ${s} 下载多个文件？` },
  localFonts: { icon: "textformat", noun: "字体" },
  idleDetection: { icon: "person.crop.circle.badge.clock", question: (s) => `允许 ${s} 了解你何时正在使用此设备？` },
  storageAccess: { icon: "externaldrive", question: (s) => `允许 ${s} 在嵌入其他网站时使用 Cookie 和网站数据？` },
  diskQuota: { icon: "internaldrive", question: (s) => `允许 ${s} 在设备上存储文件？` },
  windowManagement: { icon: "macwindow.on.rectangle", noun: "显示器以打开和放置窗口" },
  fileSystem: { icon: "folder", noun: "文件" },
  keyboardLock: { icon: "keyboard", noun: "键盘" },
  pointerLock: { icon: "cursorarrow", noun: "鼠标指针" },
  protectedMedia: { icon: "lock.shield", question: (s) => `允许 ${s} 播放受保护的内容？` },
  protocolHandler: { icon: "envelope", question: (s) => `将 ${s} 设为默认邮件应用？` },
  sensors: { icon: "gyroscope", noun: "运动传感器" },
  localNetwork: { icon: "network", noun: "本地网络上的设备" },
  vr: { icon: "visionpro", noun: "虚拟现实设备" },
  ar: { icon: "visionpro", noun: "增强现实数据" },
  handTracking: { icon: "hand.raised", noun: "手部跟踪" },
  identityProvider: { icon: "person.badge.key", question: (s) => `允许 ${s} 通过身份提供方登录？` },
  webAppInstallation: { icon: "app.badge", question: (s) => `允许 ${s} 安装网页应用？` },
  capturedSurfaceControl: { icon: "rectangle.on.rectangle", question: (s) => `允许 ${s} 滚动和缩放你共享的标签页？` },
};

const list = (words: string[]) => (words.length < 2 ? (words[0] ?? "") : `${words.slice(0, -1).join("、")}和${words.at(-1)}`);

export function describePermission(request: PermissionRequest): { icons: string[]; question: string } {
  let site = request.origin;
  try {
    site = new URL(request.origin).hostname.replace(/^www\./, "") || request.origin;
  } catch {}
  const kinds = request.permissions.map((k) => KINDS[k] ?? { icon: "questionmark.circle", noun: k });
  const icons = [...new Set(kinds.map((k) => k.icon))];
  const single = kinds.length === 1 ? kinds[0]!.question : undefined;
  if (single) return { icons, question: single(site) };
  const nouns = kinds.map((k) => k.noun).filter((n): n is string => !!n);
  if (nouns.length === kinds.length) return { icons, question: `允许 ${site} 访问你的${list(nouns)}？` };
  return { icons, question: `允许 ${site} 使用${list(request.permissions.map((k) => KINDS[k]?.noun ?? k))}？` };
}
