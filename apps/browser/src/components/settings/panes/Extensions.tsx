import { reloadExtension, type InstalledExtension } from "@ardia/ardiacore";
import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { useTheme } from "../../../lib/theme";
import { useBrowser } from "../../../store/browser";
import { useProfiles } from "../../../store/hooks";
import { engineProfile, resolveWindowId } from "../../../store/model";
import { InstallDialogHost } from "../../extensions/ExtensionOverlays";
import {
  addFromWebStore,
  configure,
  loadUnpacked,
  refreshExtensions,
  removeExtension,
  setEnabled,
  setPinned,
  useExtensionList,
} from "../../extensions/state";
import { Button, Group, PopUp, Row, SectionHeader, TextField, Toggle } from "../controls";
import { closeSettingsSheet, showSettingsSheet } from "../sheet";
import { SETTINGS_WINDOW_ID } from "../windows";

type SiteAccess = "allSites" | "specificSites" | "onClick";
const SITE_ACCESS: { value: SiteAccess; title: string }[] = [
  { value: "allSites", title: "在所有网站上" },
  { value: "specificSites", title: "在指定网站上" },
  { value: "onClick", title: "点击时" },
];
const siteAccessOf = (ext: InstalledExtension): SiteAccess =>
  ext.siteAccess === "ON_CLICK" ? "onClick" : ext.siteAccess === "ON_SPECIFIC_SITES" ? "specificSites" : "allSites";

export function ExtensionsPane() {
  const theme = useTheme();
  const profiles = useProfiles();
  const [profileId, setProfileId] = useState(() => useBrowser.getState().settings.defaultProfileId);
  const profile = engineProfile(profileId);
  const list = useExtensionList(profile);
  const [detail, setDetail] = useState<string | null>(null);
  const [link, setLink] = useState("");
  useEffect(() => {
    void refreshExtensions(profile);
  }, [profile]);

  const showInstall = () =>
    showSettingsSheet(<InstallDialogHost windowId={SETTINGS_WINDOW_ID} onClosed={closeSettingsSheet} />);
  const addLink = () => {
    if (!link.trim()) return;
    void addFromWebStore(SETTINGS_WINDOW_ID, link.trim(), profile);
    showInstall();
    setLink("");
  };

  const selected = detail ? list.find((x) => x.id === detail) : undefined;
  if (selected) return <ExtensionDetails ext={selected} profile={profile} onBack={() => setDetail(null)} />;

  return (
    <View>
      <SectionHeader
        title="扩展"
        description="通过 Chrome 应用商店中的扩展为 Ardia 添加功能。每份个人资料的扩展独立管理。"
        action={
          profiles.length > 1 ? (
            <PopUp value={profileId} options={profiles.map((p) => ({ value: p.id, title: p.name }))} onChange={setProfileId} />
          ) : undefined
        }
      />
      {list.length ? (
        <Group>
          {list.map((ext) => (
            <Row
              key={ext.id}
              icon={<Image source={{ uri: ext.icon }} style={{ width: 24, height: 24, opacity: ext.enabled ? 1 : 0.5 }} />}
              title={
                <Text numberOfLines={1} style={{ fontSize: 13, color: theme.textPrimary }}>
                  {ext.name}
                  <Text style={{ color: theme.textTertiary }}>{`  ${ext.version}${ext.fromWebStore ? "" : " · 开发者"}`}</Text>
                </Text>
              }
              description={ext.errors.length && !ext.enabled ? ext.errors[0] : ext.description}
              onPress={() => setDetail(ext.id)}
            >
              <Toggle value={ext.enabled} onChange={(on) => void setEnabled(profile, ext.id, on)} />
            </Row>
          ))}
        </Group>
      ) : (
        <Group>
          <Row title="暂无扩展" description="添加的扩展会显示在这里及扩展菜单中。" />
        </Group>
      )}

      <SectionHeader title="添加扩展" />
      <Group>
        <Row title="Chrome 应用商店" description="浏览应用商店，点击“添加至 Ardia”即可安装到这里。">
          <Button
            title="打开应用商店"
            onPress={() => {
              const windowId = resolveWindowId(useBrowser.getState());
              if (windowId) useBrowser.getState().newTab(windowId, { url: "https://chromewebstore.google.com/category/extensions" });
            }}
          />
        </Row>
        <Row title="通过链接添加" description="粘贴 Chrome 应用商店链接或扩展 ID。">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <TextField value={link} onChangeText={setLink} placeholder="chromewebstore.google.com/detail/…" onSubmit={addLink} style={{ width: 210 }} />
            <Button title="添加" disabled={!link.trim()} onPress={addLink} />
          </View>
        </Row>
        <Row title="加载已解压的扩展" description="面向开发者：加载包含 manifest.json 的扩展文件夹。">
          <Button
            title="选择文件夹…"
            onPress={() => {
              void loadUnpacked(SETTINGS_WINDOW_ID, profile);
              showInstall();
            }}
          />
        </Row>
      </Group>
    </View>
  );
}

function ExtensionDetails({ ext, profile, onBack }: { ext: InstalledExtension; profile: string; onBack: () => void }) {
  const theme = useTheme();
  const openTab = (url: string) => {
    const windowId = resolveWindowId(useBrowser.getState());
    if (windowId) useBrowser.getState().newTab(windowId, { url });
  };
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 18 }}>
        <Button title="所有扩展" icon="chevron.left" kind="plain" onPress={onBack} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 14 }}>
        <Image source={{ uri: ext.icon }} style={{ width: 48, height: 48 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: "600", color: theme.textPrimary }}>{ext.name}</Text>
          <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
            {`版本 ${ext.version}${ext.fromWebStore ? " · Chrome 应用商店" : " · 已解压"}`}
          </Text>
        </View>
        <Toggle value={ext.enabled} onChange={(on) => void setEnabled(profile, ext.id, on)} />
      </View>
      {ext.description ? <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 12, lineHeight: 18 }}>{ext.description}</Text> : null}

      <SectionHeader title="权限" />
      <Group>
        {ext.permissions.length ? (
          ext.permissions.map((p) => <Row key={p} title={p} />)
        ) : (
          <Row title="此扩展不需要特殊权限。" />
        )}
        {ext.siteAccess ? (
          <Row title="网站访问权限" description="此扩展可以读取和更改哪些网站。">
            <PopUp value={siteAccessOf(ext)} options={SITE_ACCESS} onChange={(siteAccess) => void configure(profile, ext.id, { siteAccess })} />
          </Row>
        ) : null}
      </Group>

      <SectionHeader title="设置" />
      <Group>
        <Row title="固定到工具栏" description="在地址栏旁显示扩展按钮。">
          <Toggle value={ext.pinned} onChange={(pinned) => void setPinned(profile, ext.id, pinned)} />
        </Row>
        <Row title="允许在无痕模式下运行" description="无痕模式无法阻止扩展记录您的浏览活动。">
          <Toggle value={ext.incognito} onChange={(incognito) => void configure(profile, ext.id, { incognito })} />
        </Row>
        {ext.optionsUrl ? (
          <Row title="扩展选项">
            <Button title="打开" onPress={() => openTab(ext.optionsUrl!)} />
          </Row>
        ) : null}
        {ext.webStoreUrl ? (
          <Row title="在 Chrome 应用商店中查看">
            <Button title="打开" onPress={() => openTab(ext.webStoreUrl!)} />
          </Row>
        ) : null}
        {!ext.fromWebStore ? (
          <Row title="重新加载" description={ext.path ?? undefined}>
            <Button title="重新加载" onPress={() => void reloadExtension(ext.id, profile).finally(() => refreshExtensions(profile))} />
          </Row>
        ) : null}
        {ext.errors.length ? <Row title="错误" description={ext.errors.slice(0, 5).join("\n")} /> : null}
        <Row title={<Text style={{ fontSize: 13, color: theme.textTertiary }}>{`ID ${ext.id}`}</Text>} />
      </Group>

      <View style={{ alignItems: "flex-start", marginTop: 18 }}>
        <Button
          title="移除扩展…"
          kind="destructive"
          disabled={!ext.mayModify}
          onPress={() => void removeExtension(profile, ext, SETTINGS_WINDOW_ID)}
        />
      </View>
    </View>
  );
}
