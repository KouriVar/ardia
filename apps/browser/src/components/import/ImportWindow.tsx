import type { BrowserProfile, BrowserSource, DiaAutomationStatus, DiaTabsResult, ImportedExtension, ImportKind, ImportResult, SpaceSummary } from "@ardia/import";
import { closeWindow, confirm, Symbol, VisualEffect, WindowDragRegion } from "@ardia/shell";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Animated, AppState, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../lib/theme";
import { useBrowser } from "../../store/browser";
import { useProfiles } from "../../store/hooks";
import { plural } from "../../store/model";
import type { ProfileColor } from "../../store/types";
import { useHover } from "../primitives";
import { Button, Checkbox, PopUp, useFormColors } from "../settings/controls";
import { useOnboarding } from "../onboarding/state";
import { IMPORT_WINDOW_ID } from "../settings/windows";
import { applyResult, applySafari, emptyCounts, importArcSpace, importBookmarks, importDiaProfile, openInWebStore, profileColorFor, type ImportCounts } from "./apply";
import { importModule } from "./module";

const APP = "Ardia";

type Step = "loading" | "choose" | "profiles" | "safari" | "access" | "unlock" | "dia" | "progress" | "done";
type Status = "pending" | "active" | "done" | "failed";

const KINDS: { kind: ImportKind; title: string; icon: string }[] = [
  { kind: "bookmarks", title: "书签", icon: "bookmark" },
  { kind: "history", title: "历史记录", icon: "clock" },
  { kind: "passwords", title: "密码", icon: "key" },
  { kind: "cookies", title: "Cookie（保留登录状态）", icon: "person.badge.key" },
  { kind: "autofill", title: "地址和银行卡", icon: "creditcard" },
  { kind: "tabs", title: "标签页", icon: "square.on.square" },
  { kind: "spaces", title: "空间", icon: "square.stack" },
  { kind: "pinnedTabs", title: "固定标签页", icon: "pin" },
  { kind: "favorites", title: "收藏", icon: "star" },
];
const kindTitle = (k: ImportKind) => KINDS.find((x) => x.kind === k)?.title ?? k;

const ENCRYPTED: ImportKind[] = ["passwords", "cookies", "autofill"];

const DIA_NOT_SHARED = "自定义标签页名称、颜色、空间和文件夹会留在 Dia 中，其 AppleScript 接口不提供这些数据。";

export function ImportWindow() {
  const theme = useTheme();
  const api = importModule();
  const profiles = useProfiles();
  const [step, setStep] = useState<Step>("loading");
  const [browsers, setBrowsers] = useState<BrowserSource[]>([]);
  const [source, setSource] = useState<BrowserSource | null>(null);
  const [sourceProfiles, setSourceProfiles] = useState<string[]>([]);
  const [spaces, setSpaces] = useState<string[]>([]);
  const [kinds, setKinds] = useState<Set<ImportKind>>(new Set());
  const [target, setTarget] = useState(() => defaultTarget());
  const [status, setStatus] = useState<Partial<Record<ImportKind, Status>>>({});
  const [failures, setFailures] = useState<{ kind: ImportKind; profiles: string[] }[]>([]);
  const [counts, setCounts] = useState<ImportCounts>(emptyCounts());
  const [preparing, setPreparing] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [fullDiskAccess, setFullDiskAccess] = useState(false);
  const [safariCookies, setSafariCookies] = useState(true);
  const [notes, setNotes] = useState<string[]>([]);
  const [extensions, setExtensions] = useState<{ profileId: string; list: ImportedExtension[]; opened: boolean }>({ profileId: "", list: [], opened: false });
  const onboarding = useOnboarding((s) => s.windowId !== null);
  const [diaStatus, setDiaStatus] = useState<DiaAutomationStatus | "checking" | "reading">("checking");
  const [dia, setDia] = useState<DiaTabsResult | null>(null);
  const [asking, setAsking] = useState(false);
  const diaLaunched = useRef(0);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!api || !((step === "safari" && !fullDiskAccess) || step === "access")) return;
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void recheckAccess();
    });
    return () => sub.remove();
  }, [step, fullDiskAccess, api, source?.id]);

  const recheckAccess = async () => {
    if (!api) return;
    if (step === "safari") return setFullDiskAccess(api.safariHasFullDiskAccess());
    const list = await api.listBrowsers().catch(() => null);
    if (!list) return;
    setBrowsers(list);
    const updated = list.find((b) => b.id === source?.id);
    if (updated && !updated.needsFullDiskAccess) {
      choose(updated);
      setStep("choose");
    }
  };

  useEffect(() => {
    if (!api || step !== "dia") return;
    const timer = diaStatus === "notRunning" ? setInterval(() => void refreshDia(), 1500) : null;
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active" && (diaStatus === "denied" || diaStatus === "notRunning")) void refreshDia();
    });
    return () => {
      if (timer) clearInterval(timer);
      sub.remove();
    };
  }, [step, diaStatus, api]);

  useEffect(() => {
    if (!api) return setStep("choose");
    void api
      .listBrowsers()
      .then((list) => {
        setBrowsers(list);
        const first = list.find((b) => !b.needsFullDiskAccess && !b.requiresExport && b.family !== "automation") ?? list[0];
        if (first) choose(first);
        setStep("choose");
      })
      .catch(() => setStep("choose"));
    return () => {
      abort.current?.abort();
      api.forgetUnlockedKeys();
    };
  }, []);

  const choose = (b: BrowserSource) => {
    setSource(b);
    const defaults = b.profiles.filter((p) => p.isDefault);
    setSourceProfiles((defaults.length ? defaults : b.profiles.slice(0, 1)).map((p) => p.id));
    setSpaces(b.profiles.flatMap((p) => p.spaces ?? []).map((s) => s.id));
    const available: ImportKind[] = b.requiresExport
      ? ["bookmarks", "history", "passwords"]
      : b.family === "automation"
        ? ["tabs", "pinnedTabs"]
        : [...new Set(b.profiles.flatMap((p) => p.available))];
    setKinds(new Set(available));
    if (b.family === "safari" && api) setFullDiskAccess(api.safariHasFullDiskAccess());
    setDia(null);
    setExtensions({ profileId: "", list: [], opened: false });
    setNotes([]);
    setError(null);
  };

  const allSpaces: (SpaceSummary & { profileId: string })[] = (source?.profiles ?? []).flatMap((p) => (p.spaces ?? []).map((s) => ({ ...s, profileId: p.id })));
  const isArc = source?.family === "arc";
  const isDiaTabs = source?.family === "automation";

  const next = () => {
    if (!source) return;
    setError(null);
    if (step === "choose" && isDiaTabs) {
      setDiaStatus("checking");
      setStep("dia");
      return void refreshDia();
    }
    if (step === "profiles" && isDiaTabs && dia) return void runDia(dia, sourceProfiles, kinds);
    if (step === "choose") {
      if (source.needsFullDiskAccess) return setStep("access");
      if (source.requiresExport) return setStep("safari");
      if (source.profiles.length > 1 || (isArc && allSpaces.length > 1)) return setStep("profiles");
    }
    if ((step === "choose" || step === "profiles") && ENCRYPTED.some((k) => kinds.has(k)) && source.needsKeychain && api && !api.isBrowserUnlocked(source.id)) {
      return setStep("unlock");
    }
    void run(kinds);
  };

  const unlock = async () => {
    if (!api || !source) return;
    setUnlocking(true);
    try {
      await api.unlockBrowser(source.id);
      setUnlocking(false);
      void run(kinds);
    } catch {
      setUnlocking(false);
      setError(`macOS 未允许访问 ${source.name} 的钥匙串项目。请重试，或跳过加密数据。`);
    }
  };

  const destination = async (index: number, name: string, color?: string, emoji?: string): Promise<string> => {
    if (index === 0) return target;
    const s = useBrowser.getState();
    const clash = s.profileOrder.find((id) => s.profiles[id]!.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (clash) {
      const { confirmed } = await confirm({
        title: "导入为新的个人资料？",
        message:
          "将数据导入为新的个人资料可避免数据丢失。如果替换现有个人资料，密码、Cookie 和付款信息将被替换，书签与历史记录则会合并。",
        confirmTitle: "导入为新的个人资料",
        cancelTitle: "替换此个人资料",
      });
      if (!confirmed) return clash;
    }
    return s.createProfile({ name, color: profileColorFor(color) as ProfileColor | undefined, icon: emoji ?? null });
  };

  const run = async (wanted: Set<ImportKind>) => {
    if (!api || !source) return;
    const selected = source.profiles.filter((p) => sourceProfiles.includes(p.id) || (isArc && p.spaces?.some((s) => spaces.includes(s.id))));
    const requested: ImportKind[] = [...wanted];
    if (isArc && requested.includes("tabs")) requested.push("spaces", "pinnedTabs");
    const order = KINDS.map((k) => k.kind).filter((k) => requested.includes(k));
    setStatus(Object.fromEntries(order.map((k) => [k, "pending"])));
    setPreparing(isArc ? Math.max(1, spaces.length) : selected.length);
    setStep("progress");
    abort.current = new AbortController();
    const total = emptyCounts();
    const failed = new Map<ImportKind, string[]>();
    const add = (c: ImportCounts) => (Object.keys(total) as (keyof ImportCounts)[]).forEach((k) => (total[k] += c[k]));
    let destinationIndex = 0;
    const found = new Map<string, ImportedExtension>();
    const left: string[] = [];
    let extensionsProfile = "";
    if (source.family === "firefox" && requested.includes("passwords") && !api.isBrowserUnlocked(source.id)) {
      await api.unlockBrowser(source.id).catch(() => {});
    }

    for (const profile of selected) {
      let result: ImportResult;
      try {
        result = await api.importData(source.id, profile.id, order, {
          spaceIds: isArc ? spaces : undefined,
          signal: abort.current.signal,
          onProgress: (p) => {
            if (p.phase === "start") setStatus((st) => ({ ...st, [p.kind]: "active" }));
            if (p.phase === "end") setStatus((st) => (st[p.kind] === "failed" ? st : { ...st, [p.kind]: "done" }));
          },
        });
      } catch (e) {
        if ((e as { code?: string }).code === "cancelled") return;
        for (const k of order) failed.set(k, [...(failed.get(k) ?? []), profile.name]);
        continue;
      }
      for (const k of result.failed) failed.set(k, [...(failed.get(k) ?? []), profile.name]);
      for (const w of result.warnings) {
        if (["undecryptable", "skipped", "locked"].includes(w.code) && !result.failed.includes(w.kind!)) left.push(`${w.message}.`);
      }
      const refused = (k: ImportKind) => {
        const names = failed.get(k) ?? [];
        if (!names.includes(profile.name)) failed.set(k, [...names, profile.name]);
      };

      if (isArc) {
        const profileSpaces = result.spaces;
        let first: string | null = null;
        for (const space of profileSpaces) {
          const name = space.name || "空间";
          const dest = await destination(destinationIndex++, name, space.color, space.emoji);
          first ??= dest;
          const r = importArcSpace(dest, space, name);
          add({ ...emptyCounts(), tabs: r.tabs, bookmarks: r.bookmarks });
        }
        const dest = first ?? (await destination(destinationIndex++, result.profile?.name ?? profile.name, result.profile?.color));
        add(await applyResult(dest, result, source.name, refused));
        extensionsProfile ||= dest;
      } else {
        const dest = await destination(destinationIndex++, result.profile?.name ?? profile.name, result.profile?.color ?? profile.color);
        add(await applyResult(dest, result, source.name, refused));
        extensionsProfile ||= dest;
      }
      if (source.family === "chromium" || source.family === "arc") {
        for (const e of await api.listExtensions(source.id, profile.id).catch(() => [])) found.set(e.id, e);
      }
    }
    setExtensions({ profileId: extensionsProfile, list: [...found.values()], opened: false });
    setNotes(left);
    setStatus((st) => Object.fromEntries(Object.entries(st).map(([k, v]) => [k, failed.has(k as ImportKind) ? "failed" : v === "failed" ? v : "done"])));
    setFailures([...failed].map(([kind, names]) => ({ kind, profiles: selected.length > 1 ? names : [] })));
    setCounts(total);
    api.forgetUnlockedKeys();
    setTimeout(() => setStep("done"), 700);
  };

  const refreshDia = async () => {
    if (!api) return;
    const status = await api.diaAutomationStatus().catch((): DiaAutomationStatus => "denied");
    setDiaStatus(status);
    if (status === "granted") await readDia();
  };

  const allowDia = async () => {
    if (!api) return;
    setAsking(true);
    const status = await api.requestDiaAutomation().catch((): DiaAutomationStatus => "denied");
    setAsking(false);
    setDiaStatus(status);
    if (status === "granted") await readDia();
  };

  const openDia = async () => {
    if (!api) return;
    diaLaunched.current = Date.now();
    await api.openDia().catch(() => setError("无法打开 Dia。请手动打开，然后点击“重新检查”。"));
    void refreshDia();
  };

  const readDia = async () => {
    if (!api) return;
    setError(null);
    setDiaStatus("reading");
    let result: DiaTabsResult;
    try {
      result = await api.readDiaTabs();
      for (let i = 0; !result.windowCount && Date.now() - diaLaunched.current < 15_000 && i < 8; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        result = await api.readDiaTabs();
      }
    } catch (e) {
      const code = (e as { code?: string }).code;
      setDiaStatus(code === "notRunning" ? "notRunning" : code === "locked" ? "denied" : "granted");
      if (code !== "notRunning" && code !== "locked") setError(`${(e as Error).message}. Try again.`);
      return;
    }
    setDiaStatus("granted");
    takeDiaResult(result);
  };

  const takeDiaResult = (result: DiaTabsResult) => {
    setDia(result);
    if (!result.profiles.length) {
      return setError(result.windowCount ? "Dia 没有可导入的已打开或固定网页。" : "Dia 没有打开的窗口。请先打开窗口再重试。");
    }
    const profiles: BrowserProfile[] = result.profiles.map((p, i) => ({
      id: p.id,
      name: p.name,
      path: "",
      isDefault: i === 0,
      available: ["tabs", "pinnedTabs"],
    }));
    setSource((s) => (s ? { ...s, profiles } : s));
    const first = [profiles[0]!.id];
    setSourceProfiles(first);
    if (profiles.length > 1) setStep("profiles");
    else void runDia(result, first, kinds);
  };

  const runDia = async (result: DiaTabsResult, ids: string[], wanted: Set<ImportKind>) => {
    const selected = result.profiles.filter((p) => ids.includes(p.id));
    const order = KINDS.map((k) => k.kind).filter((k) => (k === "tabs" || k === "pinnedTabs") && wanted.has(k));
    setStatus(Object.fromEntries(order.map((k) => [k, "active"])));
    setPreparing(selected.length);
    setStep("progress");
    const total = emptyCounts();
    for (const [i, p] of selected.entries()) {
      const dest = await destination(i, p.name);
      total.tabs += importDiaProfile(dest, p, { pinned: wanted.has("pinnedTabs"), open: wanted.has("tabs") });
    }
    setStatus(Object.fromEntries(order.map((k) => [k, "done"])));
    setFailures([]);
    setCounts(total);
    setTimeout(() => setStep("done"), 700);
  };

  const importSafari = async (path: string) => {
    if (!api) return;
    setError(null);
    setStatus({ bookmarks: "active", history: "active", passwords: "active", autofill: "active" });
    setPreparing(1);
    setStep("progress");
    try {
      const data = await api.importSafariExport(path);
      const failed: ImportKind[] = [];
      const c = await applySafari(target, data, false, (k) => failed.push(k));
      setStatus({ bookmarks: "done", history: "done", passwords: "done", autofill: failed.includes("autofill") ? "failed" : "done" });
      setCounts(c);
      setFailures(failed.map((kind) => ({ kind, profiles: [] })));
      setTimeout(() => setStep("done"), 700);
    } catch (e) {
      setStep("safari");
      setError((e as { code?: string }).code === "unsupported" ? "请选择文件夹或 zip 文件。" : "所选文件无效，请重试。");
    }
  };

  const importSafariDirect = async () => {
    if (!api) return;
    setError(null);
    setStatus({ bookmarks: "active", history: "active", tabs: "active", ...(safariCookies ? { cookies: "active" as const } : {}) });
    setPreparing(1);
    setStep("progress");
    abort.current = new AbortController();
    try {
      const data = await api.importSafariDirect({ signal: abort.current.signal });
      const failed: ImportKind[] = [];
      const c = await applySafari(target, data, safariCookies, (k) => failed.push(k));
      setStatus({ bookmarks: "done", history: "done", tabs: "done", ...(safariCookies ? { cookies: failed.includes("cookies") ? "failed" : ("done" as const) } : {}) });
      setCounts(c);
      setFailures(failed.map((kind) => ({ kind, profiles: [] })));
      setTimeout(() => setStep("done"), 700);
    } catch (e) {
      if ((e as { code?: string }).code === "cancelled") return;
      setStep("safari");
      setError(
        (e as { code?: string }).code === "locked"
          ? "Ardia 仍未获得完全磁盘访问权限。请在上方授权，或使用下方的导出文件。"
          : "无法读取 Safari 数据。请使用下方的导出文件。",
      );
      setFullDiskAccess(api.safariHasFullDiskAccess());
    }
  };

  const importHtml = async () => {
    if (!api) return;
    const path = await api.chooseImportFile("bookmarksHTML");
    if (!path) return;
    try {
      const root = await api.importBookmarksHTML(path);
      const n = importBookmarks(target, root, "HTML 文件");
      setCounts({ ...emptyCounts(), bookmarks: n });
      setFailures([]);
      setStatus({ bookmarks: "done" });
      setSource(null);
      setStep("done");
    } catch {
      setError("所选文件无效，请重试。");
    }
  };

  const close = () => void closeWindow(IMPORT_WINDOW_ID);

  useEffect(() => {
    if (!__DEV__) return;
    const g = globalThis as { acImport?: object };
    g.acImport = {
      select: (id: string) => {
        const b = browsers.find((x) => x.id === id);
        if (b) choose(b);
        return !!b;
      },
      next,
      back: () => setStep("choose"),
      unlock,
      kinds: [...kinds],
      setKinds: (list: ImportKind[]) => setKinds(new Set(list)),
      counts,
      failures,
      extensions,
      notes,
      step,
      diaStatus,
      dia,
      setDiaStatus,
      takeDiaResult,
      setSourceProfiles,
    };
    return () => void delete g.acImport;
  });

  let body: ReactNode = null;
  let footer: ReactNode = null;
  const targetPicker =
    profiles.length > 1 ? (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ fontSize: 12, color: theme.textSecondary }}>导入到</Text>
        <PopUp value={target} options={profiles.map((p) => ({ value: p.id, title: p.name }))} onChange={setTarget} minWidth={130} />
      </View>
    ) : (
      <View />
    );

  if (step === "loading") {
    body = <ActivityIndicator style={{ marginTop: 80 }} />;
  } else if (step === "choose") {
    body = (
      <>
        <Title title="从其他浏览器导入" subtitle="一次导入，无缝衔接。标签页、密码、书签和历史记录都会一起迁移，并保留登录状态。" />
        {!api ? (
          <Note text={`此版本的 ${APP} 不支持导入。`} />
        ) : browsers.length === 0 ? (
          <Note text="这台 Mac 上没有找到含可导入数据的其他浏览器。" />
        ) : (
          <View style={{ gap: 6 }}>
            {browsers.map((b) => (
              <BrowserRow key={b.id} browser={b} selected={source?.id === b.id} onPress={() => choose(b)} />
            ))}
          </View>
        )}
        {source && !source.requiresExport && !source.needsFullDiskAccess && (
          <View style={{ marginTop: 18 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: theme.textSecondary, marginBottom: 8 }}>选择导入内容</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
              {(isDiaTabs
                ? KINDS.filter((k) => k.kind === "tabs" || k.kind === "pinnedTabs")
                : KINDS.filter((k) => source.profiles.some((p) => p.available.includes(k.kind)) && !["spaces", "pinnedTabs"].includes(k.kind))
              ).map((k) => (
                <Checkbox
                  key={k.kind}
                  label={k.kind === "tabs" && isArc ? "空间和标签页" : k.kind === "tabs" && isDiaTabs ? "已打开的标签页" : k.title}
                  value={kinds.has(k.kind)}
                  onChange={(v) =>
                    setKinds((prev) => {
                      const n = new Set(prev);
                      if (v) n.add(k.kind);
                      else n.delete(k.kind);
                      return n;
                    })
                  }
                />
              ))}
            </View>
            {isDiaTabs && (
              <Text style={{ fontSize: 12, lineHeight: 17, color: theme.textSecondary, marginTop: 10 }}>
                {`${APP} 会在 Dia 运行时获取各个人资料的已打开和固定标签页。${DIA_NOT_SHARED}`}
              </Text>
            )}
          </View>
        )}
        {error && <ErrorText text={error} />}
      </>
    );
    footer = (
      <>
        {api ? <Button title="书签 HTML 文件…" onPress={() => void importHtml()} /> : null}
        <View style={{ flex: 1 }} />
        {targetPicker}
        <Button title="取消" onPress={close} />
        <Button title="继续" kind="primary" disabled={!source || (!source.requiresExport && !source.needsFullDiskAccess && kinds.size === 0)} onPress={next} />
      </>
    );
  } else if (step === "profiles" && source) {
    body = isArc ? (
      <>
        <Title title="选择要导入的空间" subtitle={`我们会将你的 Arc 空间、标签页和文件夹导入 ${APP}。`} />
        <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 10 }}>{`选择要导入 ${APP} 的空间。每个空间将成为独立的个人资料。`}</Text>
        <View style={{ gap: 6 }}>
          {allSpaces.map((s) => (
            <SelectRow
              key={s.id}
              selected={spaces.includes(s.id)}
              onToggle={(v) => setSpaces((prev) => (v ? [...prev, s.id] : prev.filter((x) => x !== s.id)))}
              icon={<SpaceIcon space={s} />}
              title={s.name || "空间"}
              subtitle={`${`${s.pinnedCount} 个固定标签页`} · ${`${s.tabCount} 个标签页`}`}
            />
          ))}
        </View>
      </>
    ) : (
      <>
        {isDiaTabs ? (
          <Title title="选择 Dia 个人资料" subtitle="选择要迁移标签页的个人资料。" />
        ) : (
          <Title title="解锁数据以导入" subtitle="选择要导入的个人资料。" />
        )}
        <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 10 }}>{`选择要导入 ${APP} 的个人资料。第一个将导入所选个人资料，其余将创建为新的个人资料。`}</Text>
        <View style={{ gap: 6 }}>
          {source.profiles.map((p) => (
            <SelectRow
              key={p.id}
              selected={sourceProfiles.includes(p.id)}
              onToggle={(v) => setSourceProfiles((prev) => (v ? [...prev, p.id] : prev.filter((x) => x !== p.id)))}
              icon={
                p.avatarPath ? (
                  <Image source={{ uri: `file://${p.avatarPath}` }} style={{ width: 28, height: 28, borderRadius: 14 }} />
                ) : (
                  <Monogram name={p.name} color={p.color} />
                )
              }
              title={p.name}
              subtitle={isDiaTabs ? diaProfileSummary(dia, p.id) : (p.email ?? (p.isDefault ? "默认个人资料" : undefined))}
            />
          ))}
        </View>
      </>
    );
    footer = (
      <>
        <Button title="返回" onPress={() => setStep("choose")} />
        <View style={{ flex: 1 }} />
        {targetPicker}
        <Button title="继续" kind="primary" disabled={isArc ? !spaces.length : !sourceProfiles.length} onPress={next} />
      </>
    );
  } else if (step === "unlock" && source) {
    const many = sourceProfiles.length > 1;
    body = (
      <>
        <Title
          title="解锁数据以导入"
          subtitle={`${APP} 可安全导入原浏览器的登录信息、Cookie 和银行卡，让你保持登录，无需再次输入密码。`}
        />
        <View style={{ alignItems: "center", marginTop: 10, gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            {source.iconPath ? <Image source={{ uri: `file://${source.iconPath}` }} style={{ width: 56, height: 56 }} /> : null}
            <Symbol name="arrow.right" size={16} color={theme.textTertiary} style={{ width: 20, height: 20 }} />
            <Symbol name="lock.fill" size={30} color={theme.icon} style={{ width: 56, height: 56 }} />
          </View>
          <Text style={{ fontSize: 13, lineHeight: 18, textAlign: "center", color: theme.textPrimary, maxWidth: 420 }}>
            {many
              ? `部分数据已加密，因此 macOS 会为每个所选个人资料请求一次电脑密码。`
              : `部分数据已加密，因此 macOS 会请求电脑密码，以便将数据安全导入 ${APP}。`}
          </Text>
          <Text style={{ fontSize: 12, lineHeight: 17, textAlign: "center", color: theme.textSecondary, maxWidth: 420 }}>
            {`macOS 可能会询问是否允许 ${APP} 使用钥匙串中的“${source.name} Safe Storage”，这是 ${source.name} 用来加密密码、Cookie 和银行卡的密钥。请点击“允许”。数据只保存在这台 Mac 上。`}
          </Text>
        </View>
        {error && <ErrorText text={error} />}
      </>
    );
    footer = (
      <>
        <Button title="返回" onPress={() => setStep(source.profiles.length > 1 || isArc ? "profiles" : "choose")} />
        <View style={{ flex: 1 }} />
        <Button
          title="跳过加密数据"
          onPress={() => {
            const without = new Set(kinds);
            without.delete("passwords");
            without.delete("cookies");
            setKinds(without);
            void run(without);
          }}
        />
        <Button title={unlocking ? "等待输入密码…" : "继续"} kind="primary" disabled={unlocking} onPress={() => void unlock()} />
      </>
    );
  } else if (step === "safari") {
    body = fullDiskAccess ? (
      <>
        <Title title="从 Safari 导入" subtitle={`Ardia 可直接读取 Safari，将书签、历史记录、阅读列表、已打开的标签页和登录信息导入 ${APP}。`} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 }}>
          {source?.iconPath ? <Image source={{ uri: `file://${source.iconPath}` }} style={{ width: 40, height: 40 }} /> : null}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: theme.textPrimary }}>书签、历史记录、阅读列表和标签页</Text>
            <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 1 }}>已授予完全磁盘访问权限。</Text>
            <View style={{ marginTop: 8 }}>
              <Checkbox label="Cookie（保留登录状态）" value={safariCookies} onChange={setSafariCookies} />
            </View>
          </View>
          <Button title="从 Safari 导入" kind="primary" onPress={() => void importSafariDirect()} />
        </View>
        <Text style={{ fontSize: 12, fontWeight: "600", color: theme.textSecondary, marginBottom: 8 }}>
          Passwords and payment cards can't be read directly — import them from an export file:
        </Text>
        <FileDrop onFile={(path) => void importSafari(path)} onChoose={async () => (await api?.chooseImportFile("safariExport")) ?? null} />
        {error && <ErrorText text={error} />}
      </>
    ) : (
      <>
        <Title title="允许 Ardia 访问 Safari" subtitle={`要直接导入 Safari 的书签、历史记录和标签页，${APP} 需要完全磁盘访问权限。`} />
        <FullDiskAccessSteps onOpen={() => void api?.openFullDiskAccessSettings()} onRecheck={() => void recheckAccess()} />
        <Text style={{ fontSize: 12, fontWeight: "600", color: theme.textSecondary, marginBottom: 8 }}>
          Or import everything (including passwords) from an export file:
        </Text>
        <View style={{ gap: 6, marginBottom: 12 }}>
          {["打开 Safari", "文件菜单 › 将浏览数据导出到文件", `将 .zip 文件上传到 ${APP}`].map((t, i) => (
            <Text key={t} style={{ fontSize: 12, color: theme.textSecondary }}>{`${i + 1}. ${t}`}</Text>
          ))}
        </View>
        <FileDrop onFile={(path) => void importSafari(path)} onChoose={async () => (await api?.chooseImportFile("safariExport")) ?? null} />
        {error && <ErrorText text={error} />}
      </>
    );
    footer = (
      <>
        <Button title="返回" onPress={() => setStep("choose")} />
        <View style={{ flex: 1 }} />
        {targetPicker}
        <Button title="取消" onPress={close} />
      </>
    );
  } else if (step === "access" && source) {
    body = (
      <>
        <Title title={`允许 ${APP} 访问 ${source.name}`} subtitle={`macOS 会保护 ${source.name} 的数据不被其他应用访问。要导入书签、历史记录、标签页、密码和 Cookie，${APP} 需要完全磁盘访问权限。`} />
        <FullDiskAccessSteps onOpen={() => void api?.openFullDiskAccessSettings()} onRecheck={() => void recheckAccess()} />
        {error && <ErrorText text={error} />}
      </>
    );
    footer = (
      <>
        <Button title="返回" onPress={() => setStep("choose")} />
        <View style={{ flex: 1 }} />
        <Button title="取消" onPress={close} />
      </>
    );
  } else if (step === "dia" && source) {
    const retry = <Button title="重新检查" onPress={() => void refreshDia()} />;
    if (diaStatus === "checking" || diaStatus === "reading") {
      body = <Title title="正在读取 Dia 标签页" subtitle="正在向 Dia 获取个人资料、已打开和固定的标签页…" spinner />;
    } else if (diaStatus === "notInstalled") {
      body = <Title title="尚未安装 Dia" subtitle={`安装并打开 Dia，即可将其标签页导入 ${APP}。`} />;
    } else if (diaStatus === "notRunning") {
      body = (
        <>
          <Title title="打开 Dia 以导入标签页" subtitle={`${APP} 需要向 Dia 获取标签页，因此 Dia 必须处于运行状态。打开后会自动继续。`} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Button title="打开 Dia" kind="primary" onPress={() => void openDia()} />
            {retry}
          </View>
        </>
      );
    } else if (diaStatus === "notDetermined") {
      body = (
        <>
          <Title title={`允许 ${APP} 读取 Dia 标签页`} subtitle="Dia 通过 AppleScript 提供标签页数据，macOS 会在其他应用访问前征求你的同意。" />
          <View style={{ alignItems: "center", marginTop: 10, gap: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              {source.iconPath ? <Image source={{ uri: `file://${source.iconPath}` }} style={{ width: 56, height: 56 }} /> : null}
              <Symbol name="arrow.right" size={16} color={theme.textTertiary} style={{ width: 20, height: 20 }} />
              <Symbol name="square.on.square" size={30} color={theme.icon} style={{ width: 56, height: 56 }} />
            </View>
            <Text style={{ fontSize: 13, lineHeight: 18, textAlign: "center", color: theme.textPrimary, maxWidth: 440 }}>
              {`继续后，macOS 会询问是否允许“${APP}”控制“Dia”。点击“允许”，${APP} 将获取 Dia 的个人资料、已打开和固定的标签页。此操作只会读取数据，不会更改 Dia 中的内容。`}
            </Text>
            <Text style={{ fontSize: 12, lineHeight: 17, textAlign: "center", color: theme.textSecondary, maxWidth: 440 }}>{DIA_NOT_SHARED}</Text>
          </View>
        </>
      );
    } else if (diaStatus === "denied") {
      body = (
        <>
          <Title title={`${APP} 无法读取 Dia 标签页`} subtitle={`macOS 尚未允许 ${APP} 控制 Dia。可在“系统设置 › 隐私与安全性 › 自动化”中授权。`} />
          <SettingsSteps
            steps={["点击下方的“打开自动化设置”", `在 ${APP} 下方启用 Dia`, "返回这里后会自动继续"]}
            openTitle="打开自动化设置"
            onOpen={() => void api?.openAutomationSettings()}
            onRecheck={() => void refreshDia()}
          />
        </>
      );
    } else {
      body = (
        <>
          <Title title="从 Dia 导入标签页" subtitle={DIA_NOT_SHARED} />
          <Button title="重试" onPress={() => void readDia()} />
        </>
      );
    }
    if (error) body = (
      <>
        {body}
        <ErrorText text={error} />
      </>
    );
    footer = (
      <>
        <Button title="返回" onPress={() => setStep("choose")} />
        <View style={{ flex: 1 }} />
        {targetPicker}
        <Button title="取消" onPress={close} />
        {diaStatus === "notDetermined" && (
          <Button title={asking ? "正在等待 macOS…" : "继续"} kind="primary" disabled={asking} onPress={() => void allowDia()} />
        )}
      </>
    );
  } else if (step === "progress") {
    body = (
      <>
        <Title
          title={`正在从 ${isDiaTabs ? "Dia" : (source?.name ?? "文件")} 导入`}
          subtitle={preparing > 1 ? `正在准备 ${preparing} 个个人资料` : "正在准备个人资料"}
          spinner
        />
        <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 12 }}>正在获取数据，请稍候…</Text>
        <View style={{ gap: 6 }}>
          {KINDS.filter((k) => status[k.kind]).map((k, i) => (
            <CategoryRow key={k.kind} title={k.title} icon={k.icon} status={status[k.kind]!} index={i} />
          ))}
        </View>
      </>
    );
    footer = (
      <>
        <View style={{ flex: 1 }} />
        <Button
          title="取消"
          onPress={() => {
            abort.current?.abort();
            close();
          }}
        />
      </>
    );
  } else if (step === "done") {
    const summary = [
      counts.bookmarks && `${counts.bookmarks} 条书签`,
      counts.history && `${counts.history} 条历史记录`,
      counts.passwords && `${counts.passwords} 个密码`,
      counts.cookies && `${counts.cookies} 个 Cookie`,
      counts.addresses && `${counts.addresses} 个地址`,
      counts.cards && `${counts.cards} 张银行卡`,
      counts.tabs && `${counts.tabs} 个标签页`,
    ].filter(Boolean) as string[];
    const leftBehind = notes.length ? (
      <Text style={{ fontSize: 12, lineHeight: 17, marginTop: 10, color: theme.textTertiary, textAlign: failures.length ? "left" : "center" }}>
        {notes.join(" ")}
      </Text>
    ) : null;
    const extensionList = extensions.list.length ? (
      <View style={{ alignSelf: "stretch", marginTop: 14, gap: 8 }}>
        <Text style={{ fontSize: 12, color: theme.textSecondary, textAlign: "center" }}>
          {`${source?.name ?? "你的浏览器"} 有 ${extensions.list.length} 个来自 Chrome 应用商店的扩展程序。请在那里添加需要的扩展程序：`}
        </Text>
        <Text style={{ fontSize: 12, color: theme.textPrimary, textAlign: "center" }} numberOfLines={3}>
          {extensions.list.map((e) => e.name).join(", ")}
        </Text>
        {extensions.opened ? (
          <Text style={{ fontSize: 12, color: theme.textSecondary, textAlign: "center" }}>
            {`扩展程序页面已在侧边栏打开${onboarding ? "，设置完成后即可使用" : ""}。请在需要的扩展程序页面上点击“添加到 ${APP}”。`}
          </Text>
        ) : (
          <View style={{ alignItems: "center" }}>
            <Button
              title={extensions.list.length === 1 ? "在 Chrome 应用商店中打开" : `在 Chrome 应用商店中打开 ${extensions.list.length} 个扩展程序`}
              onPress={() => {
                openInWebStore(extensions.profileId || target, extensions.list.map((e) => e.webStoreUrl));
                setExtensions((x) => ({ ...x, opened: true }));
              }}
            />
          </View>
        )}
      </View>
    ) : null;
    body = failures.length ? (
      <>
        <Title title={summary.length ? "部分导入成功" : "导入失败"} subtitle="仅导入了部分数据，请重试。" />
        <Text style={{ fontSize: 13, fontWeight: "600", color: theme.textPrimary, marginBottom: 6 }}>部分导入步骤失败：</Text>
        {failures.map((f) => (
          <Text key={f.kind} style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 3 }}>
            {f.profiles.length ? `${f.profiles.join("、")} 的${kindTitle(f.kind)}导入失败` : `${kindTitle(f.kind)}导入失败`}
          </Text>
        ))}
        {summary.length > 0 && <Text style={{ fontSize: 12, marginTop: 12, color: theme.textSecondary }}>{`已导入${summary.join("、")}。`}</Text>}
        {leftBehind}
        {extensionList}
        <Text style={{ fontSize: 12, marginTop: 12, color: theme.textTertiary }}>之后可从应用菜单重新尝试导入。</Text>
      </>
    ) : (
      <View style={{ alignItems: "center", marginTop: 40, gap: 12 }}>
        <SuccessMark />
        <Text style={{ fontSize: 20, fontWeight: "600", color: theme.textPrimary }}>一切准备就绪</Text>
        <Text style={{ fontSize: 13, color: theme.textSecondary, textAlign: "center" }}>
          {summary.length ? `已导入${summary.join("、")}。` : "没有新的内容可导入。"}
        </Text>
        {leftBehind}
        {extensionList}
      </View>
    );
    footer = (
      <>
        <View style={{ flex: 1 }} />
        {failures.length > 0 && <Button title="重试" onPress={() => setStep("choose")} />}
        <Button title={failures.length ? "继续" : "完成导入"} kind="primary" onPress={close} />
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.dark ? "#1E1E1E" : "#F4F4F4" }}>
      <VisualEffect material="windowBackground" blendingMode="behindWindow" style={StyleSheet.absoluteFill} />
      <WindowDragRegion style={{ position: "absolute", left: 0, right: 0, top: 0, height: 40 }} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 32, paddingTop: 46, paddingBottom: 20 }}>
        {body}
      </ScrollView>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 20,
          height: 56,
          borderTopWidth: StyleSheet.hairlineWidth * 2,
          borderTopColor: theme.divider,
        }}
      >
        {footer}
      </View>
    </View>
  );
}

function defaultTarget(): string {
  const s = useBrowser.getState();
  const w = s.windows[s.ui.focusedWindowId ?? ""];
  return w && !w.incognito ? w.profileId : s.settings.defaultProfileId;
}

function Title({ title, subtitle, spinner }: { title: string; subtitle?: string; spinner?: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: theme.textPrimary }}>{title}</Text>
      {subtitle ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
          {spinner && <ActivityIndicator size="small" />}
          <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: theme.textSecondary }}>{subtitle}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Note({ text }: { text: string }) {
  const theme = useTheme();
  return <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 20, textAlign: "center" }}>{text}</Text>;
}

function ErrorText({ text }: { text: string }) {
  return <Text style={{ fontSize: 12, marginTop: 12, color: "#FF9F0A" }}>{text}</Text>;
}

function BrowserRow({ browser, selected, onPress }: { browser: BrowserSource; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  const colors = useFormColors();
  const { hovered, hoverProps } = useHover();
  const spaces = browser.profiles.reduce((n, p) => n + (p.spaces?.length ?? 0), 0);
  const detail = browser.needsFullDiskAccess
    ? "需要完全磁盘访问权限"
    : browser.family === "automation"
    ? "在 Dia 运行时获取数据"
    : browser.requiresExport
    ? "直接导入或从导出的 .zip 文件导入"
    : browser.family === "arc" && spaces
      ? `${spaces} 个空间`
      : browser.profiles.length > 1
        ? `${browser.profiles.length} 个个人资料`
        : "";
  return (
    <View {...hoverProps}>
      <Pressable onPress={onPress}>
        <View
          style={{
            height: 52,
            borderRadius: 10,
            paddingHorizontal: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            backgroundColor: selected ? `${colors.accent}26` : hovered ? colors.selected : colors.group,
            borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth * 2,
            borderColor: selected ? colors.accent : colors.groupBorder,
          }}
        >
          <Radio on={selected} />
          {browser.iconPath ? (
            <Image source={{ uri: `file://${browser.iconPath}` }} style={{ width: 32, height: 32 }} />
          ) : (
            <Symbol name="globe" size={22} color={theme.icon} style={{ width: 32, height: 32 }} />
          )}
          <Text style={{ flex: 1, fontSize: 14, fontWeight: "500", color: theme.textPrimary }}>{browser.name}</Text>
          {detail ? <Text style={{ fontSize: 12, color: theme.textSecondary }}>{detail}</Text> : null}
          {browser.needsKeychain && <Symbol name="lock" size={11} color={theme.textTertiary} style={{ width: 14, height: 14 }} />}
        </View>
      </Pressable>
    </View>
  );
}

function Radio({ on }: { on: boolean }) {
  const colors = useFormColors();
  return (
    <View
      style={{
        width: 16,
        height: 16,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: on ? colors.accent : colors.control,
        borderWidth: on ? 0 : 1,
        borderColor: colors.controlBorder,
      }}
    >
      {on && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#FFFFFF" }} />}
    </View>
  );
}

function SelectRow({ selected, onToggle, icon, title, subtitle }: { selected: boolean; onToggle: (v: boolean) => void; icon: ReactNode; title: string; subtitle?: string }) {
  const theme = useTheme();
  const colors = useFormColors();
  return (
    <Pressable onPress={() => onToggle(!selected)}>
      <View
        style={{
          minHeight: 48,
          borderRadius: 10,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: colors.group,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: colors.groupBorder,
        }}
      >
        <Checkbox value={selected} onChange={onToggle} />
        {icon}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13.5, color: theme.textPrimary }}>{title}</Text>
          {subtitle ? <Text style={{ fontSize: 11.5, marginTop: 1, color: theme.textSecondary }}>{subtitle}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

function Monogram({ name, color }: { name: string; color?: string }) {
  return (
    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: color ?? "#8E8E93", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: "#FFFFFF" }}>{(name.trim()[0] ?? "?").toUpperCase()}</Text>
    </View>
  );
}

function SpaceIcon({ space }: { space: SpaceSummary }) {
  return (
    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: space.color ?? "#8E8E93", alignItems: "center", justifyContent: "center" }}>
      {space.emoji ? <Text style={{ fontSize: 15 }}>{space.emoji}</Text> : <Symbol name="square.stack" size={12} color="#FFFFFF" style={{ width: 16, height: 16 }} />}
    </View>
  );
}

function CategoryRow({ title, icon, status, index }: { title: string; icon: string; status: Status; index: number }) {
  const theme = useTheme();
  const colors = useFormColors();
  const appear = useRef(new Animated.Value(0)).current;
  const check = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: 260, delay: index * 70, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);
  useEffect(() => {
    if (status === "done" || status === "failed") Animated.spring(check, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true }).start();
  }, [status]);
  const active = status === "active";
  return (
    <Animated.View
      style={{
        opacity: appear,
        transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
        height: 44,
        borderRadius: 10,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: active ? `${colors.accent}1F` : colors.group,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: active ? `${colors.accent}66` : colors.groupBorder,
      }}
    >
      <Symbol name={icon} size={13} color={status === "pending" ? theme.textTertiary : theme.icon} style={{ width: 20, height: 20 }} />
      <Text style={{ flex: 1, fontSize: 13, color: status === "pending" ? theme.textSecondary : theme.textPrimary }}>{title}</Text>
      {active ? (
        <ActivityIndicator size="small" />
      ) : status === "pending" ? null : (
        <Animated.View style={{ transform: [{ scale: check }] }}>
          <Symbol
            name={status === "done" ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"}
            size={15}
            color={status === "done" ? "#30D158" : "#FF9F0A"}
            style={{ width: 20, height: 20 }}
          />
        </Animated.View>
      )}
    </Animated.View>
  );
}

function SuccessMark() {
  const scale = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Symbol name="checkmark.circle.fill" size={46} color="#30D158" style={{ width: 60, height: 60 }} />
    </Animated.View>
  );
}

function diaProfileSummary(dia: DiaTabsResult | null, id: string): string | undefined {
  const p = dia?.profiles.find((x) => x.id === id);
  return p ? `${`${p.pinned.length} 个固定标签页`} · ${`${p.tabs.length} 个已打开的标签页`}` : undefined;
}

function FullDiskAccessSteps({ onOpen, onRecheck }: { onOpen: () => void; onRecheck: () => void }) {
  return (
    <SettingsSteps
      steps={["点击下方的“打开完全磁盘访问设置”", `在列表中启用 ${APP}`, "返回这里后会自动继续"]}
      openTitle="打开完全磁盘访问设置"
      onOpen={onOpen}
      onRecheck={onRecheck}
    />
  );
}

function SettingsSteps({ steps, openTitle, onOpen, onRecheck }: { steps: string[]; openTitle: string; onOpen: () => void; onRecheck: () => void }) {
  const theme = useTheme();
  return (
    <>
      <View style={{ gap: 10, marginBottom: 16 }}>
        {steps.map((t, i) => (
          <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: theme.rowHover, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: theme.textSecondary }}>{i + 1}</Text>
            </View>
            <Text style={{ fontSize: 13, color: theme.textPrimary }}>{t}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <Button title={openTitle} kind="primary" onPress={onOpen} />
        <Button title="重新检查" onPress={onRecheck} />
      </View>
    </>
  );
}

function FileDrop({ onFile, onChoose }: { onFile: (path: string) => void; onChoose: () => Promise<string | null> }) {
  const theme = useTheme();
  const colors = useFormColors();
  const [over, setOver] = useState(false);
  return (
    <View
      draggedTypes={["fileUrl"]}
      onDragEnter={() => setOver(true)}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const uri = e.nativeEvent.dataTransfer?.files?.[0]?.uri;
        if (uri) onFile(decodeURIComponent(uri.replace(/^file:\/\//, "")));
      }}
      style={{
        height: 130,
        borderRadius: 12,
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: over ? colors.accent : theme.dark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)",
        backgroundColor: over ? `${colors.accent}1A` : undefined,
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
      }}
    >
      <Symbol name="doc.zipper" size={24} color={theme.textSecondary} style={{ width: 32, height: 32 }} />
      <Text style={{ fontSize: 13, color: theme.textSecondary }}>选择 .zip 文件或将其拖到这里</Text>
      <Button
        title="选择 .zip 文件"
        onPress={() =>
          void onChoose().then((path) => {
            if (path) onFile(path);
          })
        }
      />
    </View>
  );
}
