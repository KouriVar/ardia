import {
  getContentBlocker,
  getSiteSettings,
  isContentBlockerAllowed,
  setContentBlockerAllowed,
  setSiteSetting,
  type SecurityInfo,
  type SiteSettingType,
  type SiteSettingValue,
  type SiteSettings,
} from "@ardia/ardiacore";
import { displayHost } from "@ardia/core";
import { confirm, showMenu } from "@ardia/shell";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../lib/theme";
import { webviews } from "../../lib/webviews";
import { useBrowser } from "../../store/browser";
import { useSettings, useTab } from "../../store/hooks";
import { engineProfile, tabLabel } from "../../store/model";
import { Favicon } from "../primitives";
import { PANEL, PanelHeader, Popover, PopoverRow, PopoverSeparator, PopoverValue, Toggle, usePopoverPresence } from "../layout/controls";
import { pageOf, patchPage, setPopover, usePage } from "../layout/pageState";
import { showToast } from "../layout/splitActions";
import { toggleCastPicker } from "../media/cast";
import { useMedia, usePictureInPicture } from "../media/state";
import { openSettings } from "../settings/windows";
import { copyPageUrl } from "./selection";
import { canShare, shareTab } from "./share";
import { ActionTile, FooterChip, gridColumns, MoreButton, SectionTitle, SettingRow, SITE_PANEL, TileRow } from "./SiteControlsParts";
import { SiteExtensions } from "./SiteExtensions";
import { TranslateRows } from "./TranslateControls";
import { ZoomStepper } from "./ZoomControls";

type Permission = { type: SiteSettingType; title: string; icon: string; badge: string; choices: SiteSettingValue[] };

const PERMISSIONS: Permission[] = [
  { type: "camera", title: "摄像头", icon: "video", badge: "video.fill", choices: ["ask", "allow", "block"] },
  { type: "microphone", title: "麦克风", icon: "mic", badge: "mic.fill", choices: ["ask", "allow", "block"] },
  { type: "location", title: "位置", icon: "location", badge: "location.fill", choices: ["ask", "allow", "block"] },
  { type: "notifications", title: "通知", icon: "bell", badge: "bell.fill", choices: ["ask", "allow", "block"] },
  { type: "popups", title: "弹出式窗口和重定向", icon: "macwindow.on.rectangle", badge: "macwindow.on.rectangle", choices: ["allow", "block"] },
  { type: "sound", title: "声音", icon: "speaker.wave.2", badge: "speaker.wave.2.fill", choices: ["allow", "block"] },
];

const choiceTitle = (type: SiteSettingType, value: SiteSettingValue) =>
  type === "sound" ? (value === "block" ? "已静音" : "允许") : value === "allow" ? "允许" : value === "block" ? "阻止" : "询问";

type Expanded = "connection" | "more" | null;
type Blocker = { enabled: boolean; allowed: boolean };

function originOf(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.origin : null;
  } catch {
    return null;
  }
}

export function SiteControls({ tabId, open, right, left, top }: { tabId: string; open: boolean; right?: number; left?: number; top: number }) {
  const presence = usePopoverPresence(open);
  if (!presence.shown) return null;
  return <SiteControlsPanel tabId={tabId} right={right} left={left} top={top} closing={presence.closing} onClosed={presence.onClosed} />;
}

function featuredPermissions(tabId: string, settings: SiteSettings): Set<SiteSettingType> {
  const s = useBrowser.getState();
  const tab = s.tabs[tabId];
  const access = pageOf(tabId).mediaAccess;
  const inUse: Partial<Record<SiteSettingType, boolean>> = {
    camera: !!access?.camera,
    microphone: !!access?.microphone,
    sound: !!tab?.muted || !!s.live[tabId]?.playingAudio,
  };
  return new Set(PERMISSIONS.filter((p) => !settings[p.type]?.isDefault || inUse[p.type]).map((p) => p.type));
}

function SiteControlsPanel({
  tabId,
  right,
  left,
  top,
  closing,
  onClosed,
}: {
  tabId: string;
  right?: number;
  left?: number;
  top: number;
  closing: boolean;
  onClosed: () => void;
}) {
  const tab = useTab(tabId);
  const theme = useTheme();
  const security = usePage(tabId, (p) => p.security);
  const blocked = usePage(tabId, (p) => p.blocked);
  const showFullUrl = useSettings((s) => s.showFullUrl);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [featured, setFeatured] = useState<Set<SiteSettingType> | null>(null);
  const [blocker, setBlocker] = useState<Blocker | null>(null);
  const [expanded, setExpanded] = useState<Expanded>(null);
  const [cleared, setCleared] = useState<string | null>(null);
  const shareTile = useRef<View>(null);
  const url = tab?.url ?? "";
  const origin = originOf(url);
  const host = origin ? new URL(origin).hostname : "";
  const profile = engineProfile(tab?.profileId ?? "");
  const close = () => setPopover(tabId, null);
  const video = useMedia((m) => !!m.sessions[tabId]?.hasVideo || !!m.pipOpen[tabId]);
  const [pip, togglePip] = usePictureInPicture(tabId);

  useEffect(() => {
    if (!origin) return;
    let live = true;
    void getSiteSettings(profile, origin).then((s) => {
      if (!live) return;
      setSettings(s);
      setFeatured((f) => f ?? featuredPermissions(tabId, s));
    });
    void Promise.all([getContentBlocker(), isContentBlockerAllowed(host)]).then(([state, allowed]) => live && setBlocker({ enabled: state.enabled, allowed }));
    void webviews.get(tabId)?.getSecurityInfo().then((info) => live && info && patchPage(tabId, { security: info }));
    return () => {
      live = false;
    };
  }, [origin, profile]);

  if (!tab) return null;

  const setPermission = async (type: SiteSettingType, value: SiteSettingValue) => {
    if (!origin) return;
    await setSiteSetting(profile, origin, type, value);
    setSettings(await getSiteSettings(profile, origin));
    if (type === "sound") {
      useBrowser.getState().updateTab(tabId, { muted: value === "block" });
      void webviews.get(tabId)?.setMuted(value === "block");
    }
  };
  const pickPermission = async (type: SiteSettingType, choices: SiteSettingValue[]) => {
    const current = settings?.[type]?.value;
    const choice = await showMenu(choices.map((v) => ({ id: v, title: choiceTitle(type, v), checked: v === current })));
    if (choice) void setPermission(type, choice as SiteSettingValue);
  };
  const toggleBlocker = async (on: boolean) => {
    const failed = await setContentBlockerAllowed(host, !on).then(() => false, () => true);
    const allowed = await isContentBlockerAllowed(host);
    setBlocker((b) => (b ? { ...b, allowed } : b));
    if (failed) return showToast(tab.windowId, "无法更改广告拦截设置", `${host} 的拦截设置未变更，请重试。`, { icon: "exclamationmark.triangle" });
    void webviews.get(tabId)?.reload();
  };
  const clearData = async () => {
    if (!origin) return;
    const { confirmed } = await confirm({
      title: `清除 ${host} 的 Cookie 和网站数据？`,
      message: "你将退出此网站的登录，其离线数据也会被删除。",
      confirmTitle: "清理",
      destructive: true,
      windowId: tab.windowId,
    });
    if (!confirmed) return;
    const result = await webviews.get(tabId)?.clearSiteData();
    const n = result && typeof result.cookies === "number" ? result.cookies : 0;
    setCleared(n ? `已清除 ${n} 个 Cookie 及网站数据` : "已清除网站数据");
    void webviews.get(tabId)?.reload();
  };
  const share = () =>
    shareTile.current?.measureInWindow((x, y, width, height) => {
      close();
      void shareTab(tab, tab.windowId, null, [x, y, width, height]);
    });
  const cast = () => {
    close();
    void toggleCastPicker(tab.windowId);
  };
  const toggle = (section: Exclude<Expanded, null>) => setExpanded((e) => (e === section ? null : section));

  const findable = /^(https?|file):/i.test(url);
  const castTile = !video && !!origin;
  const tiles = [
    canShare(tab) ? <ActionTile key="share" ref={shareTile} icon="square.and.arrow.up" label="分享…" onPress={share} /> : null,
    <ActionTile
      key="copy"
      icon="link"
      label="复制无跟踪链接"
      onPress={() => {
        close();
        void copyPageUrl(tabId);
      }}
    />,
    findable ? (
      <ActionTile
        key="find"
        icon="text.magnifyingglass"
        label="在页面中查找"
        onPress={() => {
          close();
          useBrowser.getState().setFind(tabId, { open: true, replace: false, focusRequest: Date.now() });
        }}
      />
    ) : null,
    video ? (
      <ActionTile
        key="pip"
        icon={pip ? "pip.exit" : "pip.enter"}
        label={pip ? "退出画中画" : "画中画"}
        active={pip}
        onPress={() => {
          togglePip();
          close();
        }}
      />
    ) : castTile ? (
      <ActionTile key="cast" icon="tv.and.mediabox" label="投屏…" onPress={cast} />
    ) : null,
  ].filter(Boolean);

  const blockerValue = !blocker
    ? "…"
    : !blocker.enabled
      ? "已在设置中关闭"
      : blocker.allowed
        ? "已对此网站关闭"
        : blocked > 0
          ? `已开启 · 此页面已拦截 ${blocked} 项`
          : "On";
  const shownPermissions = featured ? PERMISSIONS.filter((p) => featured.has(p.type)) : [];
  const otherPermissions = PERMISSIONS.filter((p) => !featured?.has(p.type));
  const value = (p: Permission) => (settings ? choiceTitle(p.type, settings[p.type]?.value ?? "ask") : "…");

  return (
    <Popover width={SITE_PANEL.width} top={top} right={right} left={left} onDismiss={close} fitHeight closing={closing} onClosed={onClosed}>
      <View style={{ paddingTop: PANEL.inset }}>
        <TileRow>{tiles}</TileRow>

        <SiteExtensions windowId={tab.windowId} columns={gridColumns(tiles.length)} onClose={close} />

        {origin ? (
          <>
            <SectionTitle title="设置" tight />
            <SettingRow
              icon="shield.lefthalf.filled"
              title="拦截广告和跟踪器"
              value={blockerValue}
              on={!!blocker?.enabled && !blocker.allowed}
              onPress={
                !blocker
                  ? undefined
                  : blocker.enabled
                    ? () => void toggleBlocker(blocker.allowed)
                    : () => {
                        close();
                        openSettings("privacy");
                      }
              }
            />
            {shownPermissions.map((p) => (
              <SettingRow
                key={p.type}
                icon={p.badge}
                title={p.title}
                value={value(p)}
                on={settings?.[p.type]?.value === "allow"}
                onPress={() => void pickPermission(p.type, p.choices)}
              />
            ))}
          </>
        ) : null}

        {expanded === "connection" ? (
          <>
            <PopoverSeparator />
            <PanelHeader
              icon={<Favicon url={url} favicon={tab.favicon} size={PANEL.iconSlot} profileId={tab.profileId} />}
              title={host ? displayHost(host) : tabLabel(tab)}
              subtitle={tab.title}
            />
            <ConnectionRow security={security} />
            {security?.certificate ? <CertificateDetails security={security} /> : null}
          </>
        ) : null}

        {expanded === "more" ? (
          <>
            <PopoverSeparator />
            <PopoverRow icon="plus.magnifyingglass" title="缩放" accessory={<ZoomStepper tabId={tabId} zoom={tab.zoom} />} />
            {origin && !castTile ? <PopoverRow icon="tv.and.mediabox" title="投屏…" onPress={cast} /> : null}
            {origin ? (
              <>
                <PopoverSeparator />
                <TranslateRows tabId={tabId} onClose={close} />
                {otherPermissions.map((p) => (
                  <PopoverRow
                    key={p.type}
                    icon={p.icon}
                    title={p.title}
                    accessory={<PopoverValue title={value(p)} onPress={() => void pickPermission(p.type, p.choices)} />}
                  />
                ))}
                {otherPermissions.length ? <PopoverSeparator /> : null}
                <PopoverRow icon="trash" title="清除 Cookie 和网站数据…" detail={cleared ?? undefined} onPress={() => void clearData()} />
              </>
            ) : null}
            <PopoverRow
              icon="text.alignleft"
              title="显示完整网址"
              accessory={<Toggle value={showFullUrl} onChange={(v) => useBrowser.getState().updateSettings({ showFullUrl: v })} />}
            />
          </>
        ) : null}

        <View style={{ height: StyleSheet.hairlineWidth, marginTop: origin ? 8 : 14, marginHorizontal: PANEL.inset, backgroundColor: theme.dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)" }} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: PANEL.inset, paddingTop: 10, paddingBottom: 12 }}>
          <ConnectionChip security={security} open={expanded === "connection"} onPress={() => toggle("connection")} />
          <MoreButton open={expanded === "more"} onPress={() => toggle("more")} />
        </View>
      </View>
    </Popover>
  );
}

const WARNING = "#FF6B63";
const CAUTION = "#F2B33D";

function connectionLook(security: SecurityInfo | null) {
  const level = security?.level ?? "none";
  if (level === "secure") return { level, chip: "Secure", icon: "lock.fill", color: undefined };
  if (level === "local" || level === "none") return { level, chip: "本地页面", icon: "info.circle", color: undefined };
  if (level === "mixed") return { level, chip: "未完全安全", icon: "lock.open.trianglebadge.exclamationmark.fill", color: CAUTION };
  return { level, chip: "不安全", icon: "lock.open.trianglebadge.exclamationmark.fill", color: WARNING };
}

function ConnectionChip({ security, open, onPress }: { security: SecurityInfo | null; open: boolean; onPress: () => void }) {
  const look = connectionLook(security);
  return <FooterChip icon={look.icon} title={look.chip} color={look.color} open={open} onPress={onPress} />;
}

function ConnectionRow({ security }: { security: SecurityInfo | null }) {
  const theme = useTheme();
  const look = connectionLook(security);
  const { level } = look;
  const secure = level === "secure";
  const local = level === "local" || level === "none";
  const title = secure ? "连接安全" : local ? "这是本地或内部页面" : "连接不安全";
  const detail =
    level === "certificateError"
      ? "网站证书无效。请勿输入密码或付款信息。"
      : level === "mixed"
        ? "此页面的部分内容（例如图片）不安全。"
        : level === "insecure"
          ? "请勿在此网站输入敏感信息。"
          : secure && security?.certificate
            ? `证书颁发者：${security.certificate.issuer.organizations[0] || security.certificate.issuer.commonName}`
            : undefined;
  return <PopoverRow icon={look.icon} iconColor={look.color ?? theme.icon} title={title} detail={detail} />;
}

function CertificateDetails({ security }: { security: SecurityInfo }) {
  const theme = useTheme();
  const cert = security.certificate!;
  const date = (ms: number) => new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const rows: [string, string][] = [
    ["颁发给", cert.subject.commonName || cert.subject.displayName],
    ["Organization", cert.subject.organizations.join(", ") || "—"],
    ["颁发者", cert.issuer.commonName || cert.issuer.displayName],
    ["有效期起始日期", date(cert.validFrom)],
    ["Expires", date(cert.validUntil)],
    ...(security.protocol ? [["Protocol", security.protocol] as [string, string]] : []),
    ...(cert.sha256 ? [["SHA-256", cert.sha256.replace(/[^0-9a-f]/gi, "").replace(/(.{2})(?!$)/g, "$1 ").slice(0, 47) + "…"] as [string, string]] : []),
  ];
  return (
    <View style={{ marginHorizontal: PANEL.inset, marginTop: 2, marginBottom: 4, padding: PANEL.rowPadding, borderRadius: 8, backgroundColor: theme.dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)", gap: 3 }}>
      {rows.map(([k, v]) => (
        <View key={k} style={{ flexDirection: "row", gap: 8 }}>
          <Text style={{ width: 82, fontSize: 11, color: theme.textSecondary }}>{k}</Text>
          <Text numberOfLines={2} selectable style={{ flex: 1, fontSize: 11, color: theme.textPrimary }}>
            {v}
          </Text>
        </View>
      ))}
    </View>
  );
}
