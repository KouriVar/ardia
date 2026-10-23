import {
  clearSiteData,
  getContentBlocker,
  getExternalAppAllowances,
  getSiteSettings,
  getSiteSettingsOrigins,
  getZoomLevels,
  onContentBlockerChange,
  removeExternalAppAllowance,
  resetSiteSettings,
  setContentBlockerAllowed,
  setContentBlockerEnabled,
  setFilterListEnabled,
  setSiteSetting,
  setZoom,
  type ContentBlockerState,
  type ExternalAppAllowance,
  type FilterList,
  type FilterListCategory,
  type SiteSettings,
  type SiteSettingType,
  type SiteSettingValue,
} from "@ardia/ardiacore";
import { confirm } from "@ardia/shell";
import { useEffect, useState } from "react";
import { Image, ScrollView, Text, View } from "react-native";
import { useTheme } from "../../../lib/theme";
import { useBrowser } from "../../../store/browser";
import { useProfiles } from "../../../store/hooks";
import { engineProfile } from "../../../store/model";
import { Favicon } from "../../primitives";
import { Button, Checkbox, Group, PopUp, Row, SectionHeader, Sheet, Toggle } from "../controls";
import { closeSettingsSheet, showSettingsSheet } from "../sheet";
import { ShareDiagnosticsSection } from "./ShareDiagnostics";

const CATEGORIES: { id: FilterListCategory; toggle: string; section: string }[] = [
  { id: "ads", toggle: "拦截广告", section: "广告拦截" },
  { id: "trackers", toggle: "拦截跟踪器", section: "跟踪器" },
  { id: "cookies", toggle: "拦截 Cookie 横幅", section: "Cookie 横幅" },
  { id: "annoyances", toggle: "", section: "干扰内容" },
  { id: "security", toggle: "", section: "恶意软件与诈骗" },
  { id: "regional", toggle: "", section: "地区拦截规则" },
];

const filtersText = (n: number) => `${n.toLocaleString()} 条过滤规则`;

function useContentBlocker() {
  const [state, setState] = useState<ContentBlockerState | null>(null);
  const refresh = () => void getContentBlocker().then(setState).catch(() => {});
  useEffect(() => {
    refresh();
    const sub = onContentBlockerChange(refresh);
    return () => sub.remove();
  }, []);
  return [state, refresh] as const;
}

const categoryOn = (s: ContentBlockerState, c: FilterListCategory) => s.enabled && s.lists.some((l) => l.category === c && l.enabled);

async function setCategory(s: ContentBlockerState, c: FilterListCategory, on: boolean) {
  const lists = s.lists.filter((l) => l.category === c);
  const usual = lists.filter((l) => l.defaultOn || l.enabled);
  const starters = usual.length ? usual : lists.filter((l) => /easylist|fanboy/.test(l.id));
  for (const l of on ? (starters.length ? starters : lists) : lists.filter((l) => l.enabled)) await setFilterListEnabled(l.id, on);
  const anyOn = CATEGORIES.some((x) => (x.id === c ? on : categoryOn(s, x.id)));
  if (anyOn !== s.enabled) await setContentBlockerEnabled(anyOn);
}

export function PrivacyPane() {
  const theme = useTheme();
  const [blocker, refresh] = useContentBlocker();

  const toggleCategory = async (c: FilterListCategory, on: boolean) => {
    if (!blocker) return;
    if (!on && c === "ads") {
      const { confirmed } = await confirm({
        title: "关闭广告拦截？",
        message: "Ardia 的广告拦截可隐藏广告，让页面加载更快、更清爽。",
        confirmTitle: "关闭",
      });
      if (!confirmed) return;
    }
    try {
      await setCategory(blocker, c, on);
    } finally {
      refresh();
    }
  };

  return (
    <View>
      <SectionHeader title="内容拦截" description="基于 EasyList 和 EasyPrivacy，拦截在此 Mac 上完成。" />
      <Group>
        {CATEGORIES.filter((c) => c.toggle).map((c) => (
          <Row key={c.id} title={c.toggle}>
            <Toggle value={!!blocker && categoryOn(blocker, c.id)} disabled={!blocker} onChange={(v) => void toggleCategory(c.id, v)} />
          </Row>
        ))}
        <Row title="高级设置" description="使用额外规则和过滤器拦截各网站上的常见内容。">
          <Button title="高级…" disabled={!blocker} onPress={() => showSettingsSheet(<FilterListsSheet />)} />
        </Row>
      </Group>

      {!!blocker?.allowedHosts.length && (
        <>
          <SectionHeader title="不拦截的网站" description="通过网站控制面板关闭拦截。设置也适用于子域名。" />
          <Group>
            {blocker.allowedHosts.map((host) => (
              <Row key={host} icon={<Favicon url={`https://${host}`} />} title={host}>
                <Button
                  title="重新拦截"
                  onPress={() => void setContentBlockerAllowed(host, false).then(refresh)}
                />
              </Row>
            ))}
          </Group>
        </>
      )}

      <SitePermissions />
      <AppLinks />
      <ZoomLevels />
      {blocker && (
        <Text style={{ marginTop: 14, fontSize: 11.5, color: theme.textTertiary }}>
          {`已加载 ${(blocker.stats.networkFilters ?? 0).toLocaleString()} 条网络规则和 ${(blocker.stats.cosmeticFilters ?? 0).toLocaleString()} 条元素隐藏规则。`}
        </Text>
      )}
      <ShareDiagnosticsSection />
    </View>
  );
}

function FilterListsSheet() {
  const theme = useTheme();
  const [blocker, refresh] = useContentBlocker();
  const toggle = async (l: FilterList, on: boolean) => {
    try {
      await setFilterListEnabled(l.id, on);
      if (on && blocker && !blocker.enabled) await setContentBlockerEnabled(true);
    } finally {
      refresh();
    }
  };
  return (
    <Sheet width={500} onClose={closeSettingsSheet}>
      <Text style={{ fontSize: 15, fontWeight: "600", color: theme.textPrimary }}>广告拦截高级设置</Text>
      <Text style={{ fontSize: 12, marginTop: 4, color: theme.textSecondary }}>使用额外规则和过滤器拦截各网站上的常见内容。</Text>
      <ScrollView style={{ maxHeight: 420, marginTop: 8 }}>
        {CATEGORIES.map((c) => {
          const lists = blocker?.lists.filter((l) => l.category === c.id) ?? [];
          if (!lists.length) return null;
          return (
            <View key={c.id}>
              <SectionHeader title={c.section} />
              <Group>
                {lists.map((l) => (
                  <Row
                    key={l.id}
                    title={<Checkbox value={l.enabled} onChange={(v) => void toggle(l, v)} label={l.title} />}
                    description={l.defaultOn ? `${filtersText(l.filters)} · 默认开启` : filtersText(l.filters)}
                  />
                ))}
              </Group>
            </View>
          );
        })}
      </ScrollView>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 }}>
        <Text style={{ flex: 1, fontSize: 11.5, color: theme.textTertiary }}>
          {blocker?.version ? `由 Ardia 内置的 uBlock Origin ${blocker.version} 提供拦截。规则列表会自动更新。` : ""}
        </Text>
        <Button title="完成" kind="primary" onPress={closeSettingsSheet} />
      </View>
    </Sheet>
  );
}

function ZoomLevels() {
  const profileId = useBrowser((s) => s.settings.defaultProfileId);
  const profiles = useProfiles();
  const [selected, setSelected] = useState(profileId);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const load = () => void getZoomLevels(engineProfile(selected)).then(setLevels).catch(() => {});
  useEffect(load, [selected]);
  const hosts = Object.keys(levels).sort();
  if (!hosts.length) return null;
  return (
    <>
      <SectionHeader
        title="缩放级别"
        action={
          profiles.length > 1 ? <PopUp value={selected} options={profiles.map((p) => ({ value: p.id, title: p.name }))} onChange={setSelected} /> : undefined
        }
      />
      <Group>
        {hosts.map((host) => (
          <Row key={host} icon={<Favicon url={`https://${host}`} />} title={host} description={`${Math.round(levels[host]! * 100)}%`}>
            <Button title="重置" onPress={() => void setZoom(engineProfile(selected), host, 1).then(load)} />
          </Row>
        ))}
      </Group>
    </>
  );
}

const SETTING_LABELS: [SiteSettingType, string][] = [
  ["popups", "弹出式窗口和重定向"],
  ["camera", "摄像头"],
  ["microphone", "麦克风"],
  ["location", "位置"],
  ["notifications", "通知"],
  ["sound", "声音"],
  ["autoplay", "自动播放"],
  ["javascript", "JavaScript"],
  ["images", "图片"],
  ["clipboard", "剪贴板"],
  ["automaticDownloads", "自动下载"],
  ["cookies", "Cookie"],
  ["midi", "MIDI 设备"],
  ["windowManagement", "窗口管理"],
  ["localFonts", "字体"],
  ["storageAccess", "嵌入式内容"],
  ["fileSystem", "文件编辑"],
];

const VALUE_OPTIONS: { value: SiteSettingValue; title: string }[] = [
  { value: "default", title: "默认" },
  { value: "allow", title: "允许" },
  { value: "block", title: "阻止" },
  { value: "ask", title: "询问" },
];

function SitePermissions() {
  const profiles = useProfiles();
  const [profileId, setProfileId] = useState(() => useBrowser.getState().settings.defaultProfileId);
  const [origins, setOrigins] = useState<string[] | null>(null);
  const refresh = () => void getSiteSettingsOrigins(engineProfile(profileId)).then(setOrigins).catch(() => setOrigins([]));
  useEffect(refresh, [profileId]);

  return (
    <>
      <SectionHeader
        title="网站权限"
        description="您为网站设置的弹出式窗口、摄像头、位置等权限。"
        action={
          profiles.length > 1 ? (
            <PopUp value={profileId} options={profiles.map((p) => ({ value: p.id, title: p.name }))} onChange={setProfileId} />
          ) : undefined
        }
      />
      <Group>
        {origins === null ? null : origins.length === 0 ? (
          <Row title="暂无网站" description="允许或阻止某项权限后，相应网站会显示在这里。" />
        ) : (
          origins.map((origin) => (
            <Row
              key={origin}
              icon={<Favicon url={origin} />}
              title={origin.replace(/^https?:\/\//, "")}
              onPress={() => showSettingsSheet(<SiteSheet profileId={profileId} origin={origin} onChanged={refresh} />)}
            />
          ))
        )}
      </Group>
    </>
  );
}

function AppLinks() {
  const profiles = useProfiles();
  const [profileId, setProfileId] = useState(() => useBrowser.getState().settings.defaultProfileId);
  const [allowed, setAllowed] = useState<ExternalAppAllowance[] | null>(null);
  const refresh = () => void getExternalAppAllowances(engineProfile(profileId)).then(setAllowed).catch(() => setAllowed([]));
  useEffect(refresh, [profileId]);

  return (
    <>
      <SectionHeader
        title="允许打开链接的应用"
        description="无需询问即可打开其他应用的网站。"
        action={
          profiles.length > 1 ? (
            <PopUp value={profileId} options={profiles.map((p) => ({ value: p.id, title: p.name }))} onChange={setProfileId} />
          ) : undefined
        }
      />
      <Group>
        {allowed === null ? null : allowed.length === 0 ? (
          <Row title="暂无应用" description="网站打开应用时勾选“始终允许”，该网站就会显示在这里。" />
        ) : (
          allowed.map((a) => (
            <Row
              key={`${a.origin}|${a.scheme}`}
              icon={a.icon ? <Image source={{ uri: a.icon }} style={{ width: 20, height: 20 }} /> : <Favicon url={a.origin} />}
              title={a.origin.replace(/^https?:\/\//, "")}
              description={`使用 ${a.app ?? "已卸载的应用"} 打开 ${a.scheme}: 链接`}
            >
              <Button
                title="移除"
                onPress={() => void removeExternalAppAllowance(engineProfile(profileId), a.origin, a.scheme).then(refresh)}
              />
            </Row>
          ))
        )}
      </Group>
    </>
  );
}

function SiteSheet({ profileId, origin, onChanged }: { profileId: string; origin: string; onChanged: () => void }) {
  const theme = useTheme();
  const profile = engineProfile(profileId);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [status, setStatus] = useState("");
  const load = () => void getSiteSettings(profile, origin).then(setSettings).catch(() => {});
  useEffect(load, []);
  const set = async (type: SiteSettingType, value: SiteSettingValue) => {
    await setSiteSetting(profile, origin, type, value);
    load();
    onChanged();
  };
  return (
    <Sheet width={460} onClose={closeSettingsSheet}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Favicon url={origin} size={20} />
        <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: theme.textPrimary }}>{origin.replace(/^https?:\/\//, "")}</Text>
      </View>
      <ScrollView style={{ maxHeight: 380, marginTop: 12 }}>
        <Group>
          {SETTING_LABELS.filter(([type]) => settings?.[type]).map(([type, label]) => (
            <Row key={type} title={label} description={settings![type].isDefault ? `默认（${({ allow: "允许", block: "阻止", ask: "询问" } as Record<string, string>)[settings![type].value] ?? settings![type].value}）` : undefined}>
              <PopUp
                value={settings![type].isDefault ? "default" : settings![type].value}
                options={VALUE_OPTIONS}
                onChange={(v) => void set(type, v)}
                minWidth={100}
              />
            </Row>
          ))}
        </Group>
      </ScrollView>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 }}>
        <Button
          title="重置权限"
          onPress={() =>
            void resetSiteSettings(profile, origin).then(() => {
              load();
              onChanged();
            })
          }
        />
        <Button
          title="清除网站数据"
          onPress={() =>
            void clearSiteData(profile, origin).then((r) =>
              setStatus(r.cookies === false ? "已清除网站数据。" : `已清除 ${r.cookies} 个 Cookie 和网站数据。`),
            )
          }
        />
        <Text style={{ flex: 1, fontSize: 12, color: theme.textSecondary }}>{status}</Text>
        <Button title="完成" kind="primary" onPress={closeSettingsSheet} />
      </View>
    </Sheet>
  );
}
