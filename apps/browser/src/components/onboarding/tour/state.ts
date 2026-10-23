import { systemInfo } from "@ardia/shell";
import { create } from "zustand";
import { openUrls } from "../../../lib/actions";
import { useBrowser } from "../../../store/browser";
import { resolveWindowId } from "../../../store/model";
import { closeReleaseNotes } from "../../ntp/releaseNotes";
import { locateAnchor, type TourAnchor } from "./anchors";

export type TourStop = {
  id: string;
  title: string;
  body: string;
  anchor?: TourAnchor;
  placement?: "below" | "right" | "inside";
  radius?: number;
  pad?: number;
};

const TOUR_STOPS: TourStop[] = [
  {
    id: "commandBar",
    title: "搜索或前往任何地方",
    body: "输入问题、网址或已打开标签页的名称。在任何页面按 ⌘L 打开命令栏，按 ⌘T 新建标签页。",
    anchor: "commandBar",
    placement: "below",
    radius: 20,
    pad: 6,
  },
  {
    id: "tabs",
    title: "标签页都在侧边栏",
    body: "新标签页会显示在这里。拖动可排序或分组；右键点击即可固定，随时一键访问。",
    anchor: "tabs",
    placement: "right",
    radius: 10,
    pad: 4,
  },
  {
    id: "sidebar",
    title: "专注浏览的空间",
    body: "按 ⌘S 隐藏侧边栏。隐藏后，将指针移到窗口左边缘即可临时查看标签页。",
    anchor: "sidebarButton",
    placement: "below",
    radius: 9,
    pad: 3,
  },
  {
    id: "split",
    title: "两个页面，并排浏览",
    body: "将标签页拖到页面上或按 ⌃⇧= 即可分屏。按 ⌃⇧] 和 ⌃⇧[ 可在分屏之间切换。",
    anchor: "page",
    placement: "inside",
    radius: 10,
    pad: -10,
  },
  {
    id: "done",
    title: "一切准备就绪",
    body: "其他功能都在菜单栏和设置 (⌘,) 中。你也可以从帮助菜单重新查看导览。",
  },
];

type TourState = {
  windowId: string | null;
  stops: TourStop[];
  index: number;
  session: number;
};

export const useTour = create<TourState>(() => ({ windowId: null, stops: [], index: 0, session: 0 }));

export async function startToolTour(windowId?: string | null) {
  const id = resolveWindowId(useBrowser.getState(), windowId);
  if (!id) return;
  const session = useTour.getState().session + 1;
  useTour.setState({ windowId: null, stops: [], index: 0, session });
  closeReleaseNotes();
  const found = await Promise.all(TOUR_STOPS.map((stop) => (stop.anchor ? locateAnchor(id, stop.anchor) : Promise.resolve(true))));
  if (useTour.getState().session !== session) return;
  useTour.setState({ windowId: id, stops: TOUR_STOPS.filter((_, i) => !!found[i]) });
}

export function endToolTour() {
  useTour.setState((s) => ({ windowId: null, stops: [], index: 0, session: s.session + 1 }));
}

export function stepToolTour(delta: number) {
  const { index, stops } = useTour.getState();
  const next = index + delta;
  if (next >= stops.length) return endToolTour();
  useTour.setState({ index: Math.max(0, next) });
}

export function videoTourUrl(): string | null {
  const url = systemInfo().videoTourURL;
  return url && /^https?:\/\//i.test(url) ? url : null;
}

export function openVideoTour(windowId?: string | null) {
  const url = videoTourUrl();
  if (url) openUrls([url], windowId);
}

if (__DEV__) (globalThis as { acTour?: unknown }).acTour = { store: useTour, start: startToolTour, step: stepToolTour, end: endToolTour };
