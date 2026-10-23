import {
  addToDock,
  fileExists,
  fileIcon,
  isDefaultBrowser,
  isInDock,
  launchAtLoginStatus,
  setAsDefaultBrowser,
  setLaunchAtLogin,
  Symbol,
} from "@ardia/shell";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { PROFILE_COLORS, themeFor, useTheme } from "../../lib/theme";
import { useBrowser } from "../../store/browser";
import { Favicon, useHover } from "../primitives";
import { openImport } from "../settings/windows";
import { PERSONALIZE_COPY, TabLayoutPicker, ThemeColorPicker } from "./personalize";
import { PINNABLE_SITES, pinSites, preselectedSites } from "./sites";
import { finishOnboarding, recordDefaultBrowserTrial, useOnboarding } from "./state";
import { CheckMark, CheckRow, PrimaryButton, Reveal, SecondaryButton, StepProgress, StepTitle, useOnboardingColors } from "./ui";

const ICON = require("../../../assets/app-icon.png");

export function StepLayout({ children, actions, preview }: { children: ReactNode; actions: ReactNode; preview: ReactNode }) {
  const colors = useOnboardingColors();
  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      <View style={{ width: 460, paddingHorizontal: 40, paddingTop: 34, paddingBottom: 32, justifyContent: "space-between" }}>
        <View style={{ gap: 20 }}>
          <Reveal>
            <StepProgress />
          </Reveal>
          {children}
        </View>
        <Reveal delay={240} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {actions}
        </Reveal>
      </View>
      <View
        style={{
          flex: 1,
          margin: 12,
          marginLeft: 0,
          borderRadius: 14,
          backgroundColor: colors.preview,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: colors.previewBorder,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Reveal delay={120} style={{ alignItems: "center", justifyContent: "center" }}>
          {preview}
        </Reveal>
      </View>
    </View>
  );
}

type SystemState = { isDefault: boolean; inDock: boolean; loginEnabled: boolean };

export function DefaultBrowserStep() {
  const next = useOnboarding((s) => s.next);
  const [system, setSystem] = useState<SystemState | null>(null);
  const [setDefault, setSetDefault] = useState(true);
  const [trial, setTrial] = useState(false);
  const [dock, setDock] = useState(true);
  const [login, setLogin] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all([isDefaultBrowser(), isInDock(), launchAtLoginStatus()]).then(([isDefault, inDock, login]) => {
      setSystem({ isDefault, inDock, loginEnabled: login === "enabled" });
      if (login === "enabled") setLogin(true);
    });
  }, []);

  const apply = async () => {
    if (!system) return;
    setBusy(true);
    try {
      if (!system.isDefault && (setDefault || trial) && (await setAsDefaultBrowser()) && !setDefault) recordDefaultBrowserTrial();
      if (login !== system.loginEnabled) await setLaunchAtLogin(login).catch(() => {});
      if (dock && !system.inDock) await addToDock();
    } finally {
      setBusy(false);
      next();
    }
  };

  const defaultOn = system?.isDefault || setDefault;
  const trying = !defaultOn && trial;
  return (
    <StepLayout
      actions={<PrimaryButton title={busy ? "正在设置…" : "继续"} onPress={() => void apply()} disabled={!system || busy} />}
      preview={<SystemPreview isDefault={!!(defaultOn || trying)} dock={!!(system?.inDock || dock)} login={login} />}
    >
      <Reveal delay={60}>
        <StepTitle title="快速、安全，具备你需要的全部浏览功能" subtitle="将 Ardia 设为默认浏览器，体验更顺畅。" />
      </Reveal>
      <Reveal delay={140} style={{ gap: 6 }}>
        <CheckRow
          icon="globe"
          title="将 Ardia 设为默认浏览器"
          subtitle={system?.isDefault ? "Ardia 已是你的默认浏览器" : "默认使用 Ardia 打开链接和网页"}
          value={defaultOn}
          disabled={!system || system.isDefault}
          onChange={setSetDefault}
        />
        {system && !defaultOn ? (
          <CheckRow
            icon="calendar"
            title="试用 Ardia 作为默认浏览器七天"
            subtitle="之后我们会询问你的使用感受。"
            value={trial}
            onChange={setTrial}
          />
        ) : null}
        {system && !system.inDock ? (
          <CheckRow icon="dock.rectangle" title="将 Ardia 添加到程序坞" subtitle="随时快速打开 Ardia" value={dock} onChange={setDock} />
        ) : null}
        <CheckRow icon="power" title="登录时打开 Ardia" subtitle="登录后自动打开 Ardia" value={login} onChange={setLogin} />
      </Reveal>
    </StepLayout>
  );
}

function SystemPreview({ isDefault, dock, login }: { isDefault: boolean; dock: boolean; login: boolean }) {
  const colors = useOnboardingColors();
  const chip = (on: boolean, icon: string, label: string) => (
    <View
      key={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        height: 34,
        paddingLeft: 12,
        paddingRight: 10,
        borderRadius: 17,
        backgroundColor: colors.row,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: colors.rowBorder,
        opacity: on ? 1 : 0.45,
      }}
    >
      <Symbol name={icon} size={13} color={colors.title} style={{ width: 16, height: 16 }} />
      <Text style={{ fontSize: 12, fontWeight: "500", color: colors.title }}>{label}</Text>
      <CheckMark on={on} size={16} />
    </View>
  );
  return (
    <View style={{ alignItems: "center", gap: 28 }}>
      <Image source={ICON} style={{ width: 132, height: 132 }} />
      <View style={{ gap: 8, alignItems: "center" }}>
        {chip(isDefault, "globe", "默认浏览器")}
        {chip(dock, "dock.rectangle", "已添加到程序坞")}
        {chip(login, "power", "登录时打开")}
      </View>
    </View>
  );
}

export function PersonalizeStep() {
  const next = useOnboarding((s) => s.next);
  const windowId = useOnboarding((s) => s.windowId) ?? "";
  const colors = useOnboardingColors();
  return (
    <StepLayout actions={<PrimaryButton title="继续" onPress={next} />} preview={<WindowPreview windowId={windowId} />}>
      <Reveal delay={60}>
        <StepTitle title={PERSONALIZE_COPY.title} subtitle={PERSONALIZE_COPY.subtitle} />
      </Reveal>
      <Reveal delay={140} style={{ gap: 18 }}>
        <ThemeColorPicker windowId={windowId} size={32} />
        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 12.5, color: colors.subtitle }}>{PERSONALIZE_COPY.layouts}</Text>
          <TabLayoutPicker windowId={windowId} />
        </View>
      </Reveal>
    </StepLayout>
  );
}

function WindowPreview({ windowId }: { windowId: string }) {
  const colors = useOnboardingColors();
  const dark = useTheme().dark;
  const color = useBrowser((s) => s.profiles[s.windows[windowId]?.profileId ?? ""]?.color ?? "plum");
  const layout = useBrowser((s) => s.windows[windowId]?.tabLayout ?? s.settings.tabLayout);
  const theme = themeFor(`${color}:${dark ? "dark" : "light"}`);
  const swatch = PROFILE_COLORS[color]?.swatch ?? PROFILE_COLORS.plum.swatch;
  const line = { height: 6, borderRadius: 3, backgroundColor: colors.progressTrack };
  return (
    <View
      style={{
        width: 280,
        height: 184,
        borderRadius: 12,
        padding: 7,
        gap: 6,
        backgroundColor: theme.windowTint[0],
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: colors.rowBorder,
        flexDirection: layout === "sidebar" ? "row" : "column",
      }}
    >
      {layout === "sidebar" ? (
        <View style={{ width: 70, gap: 6, paddingTop: 4 }}>
          <View style={{ flexDirection: "row", gap: 4, marginBottom: 6 }}>
            {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
              <View key={c} style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: c }} />
            ))}
          </View>
          <View style={[line, { width: "90%", height: 16, borderRadius: 5, backgroundColor: theme.card }]} />
          {[0.8, 0.6, 0.7].map((w, i) => (
            <View key={i} style={[line, { width: `${w * 100}%` }]} />
          ))}
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 18 }}>
          <View style={{ flexDirection: "row", gap: 4, marginRight: 6 }}>
            {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
              <View key={c} style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: c }} />
            ))}
          </View>
          <View style={[line, { width: 56, height: 14, borderRadius: 5, backgroundColor: theme.card }]} />
          {[0, 1].map((i) => (
            <View key={i} style={[line, { width: 44 }]} />
          ))}
        </View>
      )}
      <View style={{ flex: 1, borderRadius: 7, backgroundColor: theme.card, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: "62%", height: 22, borderRadius: 7, backgroundColor: colors.card, borderWidth: 1, borderColor: `${swatch}99` }} />
      </View>
    </View>
  );
}

const BROWSERS = [
  { name: "Chrome", path: "/Applications/Google Chrome.app" },
  { name: "Safari", path: "/Applications/Safari.app" },
  { name: "Arc", path: "/Applications/Arc.app" },
  { name: "Dia", path: "/Applications/Dia.app" },
  { name: "Helium", path: "/Applications/Helium.app" },
  { name: "Firefox", path: "/Applications/Firefox.app" },
  { name: "Edge", path: "/Applications/Microsoft Edge.app" },
  { name: "Brave", path: "/Applications/Brave Browser.app" },
  { name: "Opera", path: "/Applications/Opera.app" },
  { name: "Vivaldi", path: "/Applications/Vivaldi.app" },
];

export function ImportStep() {
  const next = useOnboarding((s) => s.next);
  const colors = useOnboardingColors();
  const [opened, setOpened] = useState(false);
  const [icons, setIcons] = useState<{ name: string; uri: string }[]>([]);

  useEffect(() => {
    const installed = BROWSERS.filter((b) => fileExists(b.path)).slice(0, 6);
    void Promise.all(installed.map(async (b) => ({ name: b.name, uri: (await fileIcon(b.path, 56)) ?? "" }))).then((list) =>
      setIcons(list.filter((i) => i.uri)),
    );
  }, []);

  const importNow = () => {
    openImport();
    setOpened(true);
  };

  return (
    <StepLayout
      actions={
        opened ? (
          <PrimaryButton title="继续" onPress={next} />
        ) : (
          <>
            <PrimaryButton title="导入…" onPress={importNow} />
            <SecondaryButton title="跳过" onPress={next} />
          </>
        )
      }
      preview={
        <View style={{ alignItems: "center", gap: 22 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 14, maxWidth: 300 }}>
            {icons.map((i) => (
              <View key={i.name} style={{ alignItems: "center", gap: 6, width: 72 }}>
                <Image source={{ uri: i.uri }} style={{ width: 56, height: 56 }} />
                <Text style={{ fontSize: 11, color: colors.subtitle }}>{i.name}</Text>
              </View>
            ))}
          </View>
          <Symbol name="arrow.down" size={18} weight="medium" color={colors.steps} style={{ width: 24, height: 24 }} />
          <Image source={ICON} style={{ width: 72, height: 72 }} />
        </View>
      }
    >
      <Reveal delay={60}>
        <StepTitle
          title="迁移你的浏览数据"
          subtitle={
            opened
              ? "在导入窗口中完成操作，然后返回这里继续。之后可随时从 Ardia 菜单导入更多数据。"
              : "从当前浏览器导入书签、历史记录、密码和标签页，同时保留网站登录状态。所有数据都保存在这台 Mac 上。"
          }
        />
      </Reveal>
    </StepLayout>
  );
}

export function PinnedTabsStep() {
  const next = useOnboarding((s) => s.next);
  const windowId = useOnboarding((s) => s.windowId);
  const history = useBrowser((s) => s.history[s.windows[windowId ?? ""]?.profileId ?? ""]);
  const initial = useMemo(() => preselectedSites(history ?? []), []);
  const [selected, setSelected] = useState<string[]>(initial);

  const toggle = (id: string) => setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  const pinSelected = () => {
    if (windowId) pinSites(windowId, selected);
    next();
  };

  return (
    <StepLayout
      actions={
        <>
          <PrimaryButton title={selected.length ? `固定 ${selected.length} 个标签页` : "继续"} onPress={pinSelected} />
          {selected.length ? <SecondaryButton title="跳过" onPress={next} /> : null}
        </>
      }
      preview={<PinnedPreview selected={selected} />}
    >
      <Reveal delay={60}>
        <StepTitle title="随时使用喜爱的应用" subtitle="固定重要的应用，打开 Ardia 即可随时访问。" />
      </Reveal>
      <Reveal delay={140} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {PINNABLE_SITES.map((site) => (
          <SiteTile key={site.id} title={site.title} url={site.url} selected={selected.includes(site.id)} onPress={() => toggle(site.id)} />
        ))}
      </Reveal>
    </StepLayout>
  );
}

function SiteTile({ title, url, selected, onPress }: { title: string; url: string; selected: boolean; onPress: () => void }) {
  const colors = useOnboardingColors();
  const { hovered, hoverProps } = useHover();
  return (
    <View {...hoverProps}>
      <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={title}>
        {({ pressed }) => (
          <View
            mouseDownCanMoveWindow={false}
            style={{
              width: 80,
              height: 70,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              backgroundColor: selected || hovered ? colors.button : colors.row,
              borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth * 2,
              borderColor: selected ? colors.title : colors.rowBorder,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            }}
          >
            <View style={{ opacity: selected || hovered ? 1 : 0.7 }}>
              <Favicon url={url} size={22} />
            </View>
            <Text style={{ fontSize: 11, fontWeight: "500", color: selected ? colors.title : colors.subtitle }}>{title}</Text>
            {selected ? (
              <View style={{ position: "absolute", top: 5, right: 5 }}>
                <CheckMark on size={14} />
              </View>
            ) : null}
          </View>
        )}
      </Pressable>
    </View>
  );
}

function PinnedPreview({ selected }: { selected: string[] }) {
  const colors = useOnboardingColors();
  const sites = PINNABLE_SITES.filter((s) => selected.includes(s.id));
  const slots = Math.max(6, Math.ceil(sites.length / 3) * 3);
  return (
    <View style={{ width: 236, padding: 14, borderRadius: 14, backgroundColor: colors.row, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.rowBorder, gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <View key={c} style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: c }} />
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {Array.from({ length: slots }, (_, i) => {
          const site = sites[i];
          return (
            <View
              key={site?.id ?? `empty-${i}`}
              style={{
                width: 64,
                height: 40,
                borderRadius: 9,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: site ? colors.button : "transparent",
                borderWidth: site ? 0 : 1,
                borderStyle: "dashed",
                borderColor: colors.rowBorder,
              }}
            >
              {site ? <Favicon url={site.url} size={18} /> : null}
            </View>
          );
        })}
      </View>
      <View style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.separator }} />
      {[0.7, 0.5, 0.6].map((w, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 22 }}>
          <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: colors.progressTrack }} />
          <View style={{ height: 6, borderRadius: 3, width: `${w * 100}%`, backgroundColor: colors.progressTrack }} />
        </View>
      ))}
    </View>
  );
}

export function OutroStep() {
  const colors = useOnboardingColors();
  return (
    <StepLayout
      actions={
        <>
          <PrimaryButton title="开始使用" icon="arrow.right" onPress={() => finishOnboarding()} />
          <SecondaryButton title="查看功能导览" onPress={() => finishOnboarding({ tour: true })} />
        </>
      }
      preview={<Postcard />}
    >
      <Reveal delay={60}>
        <StepTitle title={"欢迎来到你在\n互联网上的新家"} subtitle="所有设置均已保存。之后可随时在设置中更改。" />
      </Reveal>
      <Reveal delay={140} style={{ gap: 10 }}>
        {[
          ["⌘T", "打开新标签页"],
          ["⌘L", "从命令栏前往任何地方"],
          ["⌘S", "隐藏侧边栏，获得更大空间"],
        ].map(([keys, label]) => (
          <View key={keys} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ minWidth: 38, height: 24, paddingHorizontal: 7, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: colors.button }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: colors.title }}>{keys}</Text>
            </View>
            <Text style={{ fontSize: 13, color: colors.subtitle }}>{label}</Text>
          </View>
        ))}
      </Reveal>
    </StepLayout>
  );
}

function Postcard() {
  const colors = useOnboardingColors();
  return (
    <View
      style={{
        width: 300,
        height: 200,
        borderRadius: 6,
        padding: 18,
        flexDirection: "row",
        backgroundColor: colors.card,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: colors.rowBorder,
        transform: [{ rotate: "-3deg" }],
      }}
    >
      <View style={{ flex: 1, justifyContent: "space-between", paddingRight: 14 }}>
        <Text style={{ fontSize: 20, fontWeight: "300", fontStyle: "italic", color: colors.title }}>你好！</Text>
        <Text style={{ fontSize: 12, lineHeight: 17, color: colors.subtitle }}>
          {"欢迎来到这里。标签页、书签和固定页面都已准备就绪，开始自在浏览吧。"}
        </Text>
      </View>
      <View style={{ width: StyleSheet.hairlineWidth * 2, backgroundColor: colors.separator }} />
      <View style={{ width: 104, paddingLeft: 14, justifyContent: "space-between", alignItems: "flex-end" }}>
        <View style={{ padding: 4, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.rowBorder, borderRadius: 3 }}>
          <Image source={ICON} style={{ width: 46, height: 46 }} />
        </View>
        <View style={{ alignSelf: "stretch", gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ height: 1, backgroundColor: colors.separator }} />
          ))}
        </View>
      </View>
      <View
        style={{
          position: "absolute",
          right: 54,
          top: 52,
          width: 44,
          height: 44,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: colors.steps,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ rotate: "-12deg" }],
        }}
      >
        <Text numberOfLines={1} style={{ fontSize: 6, fontWeight: "700", letterSpacing: 0.4, color: colors.steps }}>
          WELCOME
        </Text>
      </View>
    </View>
  );
}
