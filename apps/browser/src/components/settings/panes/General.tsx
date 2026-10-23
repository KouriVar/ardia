import {
  checkForUpdates,
  isDefaultBrowser,
  launchAtLoginStatus,
  setAsDefaultBrowser,
  setAutomaticUpdateChecks,
  setAutomaticUpdateDownloads,
  setLaunchAtLogin,
  setUpdateChannel,
  Symbol,
  updaterState,
  type UpdateChannel,
  type UpdaterState,
} from "@ardia/shell";
import { useEffect, useState } from "react";
import { AppState, Text, View } from "react-native";
import { useTheme } from "../../../lib/theme";
import { useBrowser } from "../../../store/browser";
import { SHARING_COPY } from "../../../telemetry/copy";
import { Button, Group, PopUp, Row, SectionHeader, Toggle, useFormColors } from "../controls";
import { openImport } from "../windows";

const APP = "Ardia";

export function GeneralPane() {
  const settings = useBrowser((s) => s.settings);
  const update = useBrowser((s) => s.updateSettings);
  const [loginStatus, setLoginStatus] = useState<string>("notRegistered");

  const refreshLogin = () => void launchAtLoginStatus().then(setLoginStatus);
  useEffect(refreshLogin, []);

  return (
    <View>
      <DefaultBrowserBanner />

      <SectionHeader title="通用" />
      <Group>
        <Row
          title={`登录时打开 ${APP}`}
          description={loginStatus === "requiresApproval" ? "在“系统设置 › 通用 › 登录项”中允许。" : undefined}
        >
          <Toggle
            value={loginStatus === "enabled" || loginStatus === "requiresApproval"}
            onChange={(on) => void setLaunchAtLogin(on).catch(() => {}).finally(refreshLogin)}
          />
        </Row>
        <Row title="退出前提醒" description={`使用 ⌘Q 退出 ${APP} 前询问。`}>
          <Toggle value={settings.warnBeforeQuitting} onChange={(v) => update({ warnBeforeQuitting: v })} />
        </Row>
        <Row title="关闭包含多个标签页的窗口前提醒" description="通过 ⇧⌘W 或关闭按钮关闭标签页前询问。">
          <Toggle value={settings.warnBeforeClosingWindow} onChange={(v) => update({ warnBeforeClosingWindow: v })} />
        </Row>
        <Row
          title="打开其他应用链接的位置"
          description={
            settings.openLinksInLittleArdia
              ? `来自 Discord、Slack 或邮件的链接会在 Little Ardia 独立小窗口中打开。按 ⌘O 可移入 ${APP}；关闭即丢弃。`
              : `来自 Discord、Slack 或邮件的链接会在您上次使用的 ${APP} 窗口中新建标签页。`
          }
        >
          <PopUp
            value={settings.openLinksInLittleArdia ? "small" : "tab"}
            options={[
              { value: "small", title: "Little Ardia" },
              { value: "tab", title: "新标签页" },
            ]}
            onChange={(v) => update({ openLinksInLittleArdia: v === "small" })}
            minWidth={190}
          />
        </Row>
      </Group>

      <SectionHeader title={`退出 ${APP} 时：`} />
      <Group>
        <Row title="窗口与标签页" description="下次启动时显示的内容。已关闭的窗口会保留在“历史记录 › 最近关闭”中。">
          <PopUp
            value={settings.restoreSession ? "keep" : "close"}
            options={[
              { value: "keep", title: "保留标签页与窗口" },
              { value: "close", title: "全新开始" },
            ]}
            onChange={(v) => update({ restoreSession: v === "keep" })}
            minWidth={190}
          />
        </Row>
      </Group>

      <SectionHeader title="命令栏" description="输入内容既可能是网址也可能是搜索词时的处理方式。" />
      <Group>
        <Row title="输入内容看起来像网址时">
          <PopUp
            value={settings.commandBarPreference}
            options={[
              { value: "website", title: "优先打开网站" },
              { value: "search", title: "优先使用搜索引擎" },
            ]}
            onChange={(v) => update({ commandBarPreference: v })}
            minWidth={190}
          />
        </Row>
      </Group>

      <UpdatesSection />

      <SectionHeader title="导入" />
      <Group>
        <Row title="从其他浏览器导入" description="从 Chrome、Arc、Safari、Firefox 等浏览器导入书签、历史记录、密码、标签页和 Arc 空间。">
          <Button title="导入…" onPress={openImport} />
        </Row>
      </Group>
    </View>
  );
}

function UpdatesSection() {
  const [state, setState] = useState<UpdaterState | null>(null);
  const refresh = () => void updaterState().then(setState, () => setState({ available: false }));
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", refresh);
    return () => sub.remove();
  }, []);
  if (!state?.available) return null;
  const ready = state.configured;
  const set = (patch: { automaticChecks?: boolean; automaticDownloads?: boolean; channel?: UpdateChannel }) => {
    setState({ ...state, ...patch });
    if (patch.automaticChecks !== undefined) void setAutomaticUpdateChecks(patch.automaticChecks).finally(refresh);
    if (patch.automaticDownloads !== undefined) void setAutomaticUpdateDownloads(patch.automaticDownloads).finally(refresh);
    if (patch.channel !== undefined) void setUpdateChannel(patch.channel).finally(refresh);
  };
  const lastCheck = state.lastCheck
    ? `上次检查：${new Date(state.lastCheck).toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" })}。`
    : "尚未检查。";
  return (
    <>
      <SectionHeader title="更新" description={ready ? undefined : "此构建版本未配置更新。"} />
      <Group>
        <Row title="自动检查更新" description={`${SHARING_COPY.updateChecks} ${SHARING_COPY.switchFile}`}>
          <Toggle value={ready && state.automaticChecks} disabled={!ready} onChange={(v) => set({ automaticChecks: v })} />
        </Row>
        <Row title={`自动更新 ${APP}`} description="在后台下载更新，并在下次重启时安装。">
          <Toggle
            value={ready && state.automaticChecks && state.automaticDownloads}
            disabled={!ready || !state.automaticChecks}
            onChange={(v) => set({ automaticDownloads: v })}
          />
        </Row>
        {state.channel && (
          <Row title="更新渠道" description="每夜构建版会最先获得各项修复。切回稳定版不会降级。">
            <PopUp
              value={state.channel}
              options={[
                { value: "stable", title: "稳定版" },
                { value: "nightly", title: "每夜构建版" },
              ]}
              disabled={!ready}
              onChange={(channel) => set({ channel })}
              minWidth={190}
            />
          </Row>
        )}
        <Row title={`${APP} ${state.displayVersion ?? state.version}`} description={ready ? lastCheck : undefined}>
          <Button title="立即检查" disabled={ready && (!state.canCheck || state.sessionInProgress)} onPress={() => void checkForUpdates().finally(refresh)} />
        </Row>
      </Group>
    </>
  );
}

function DefaultBrowserBanner() {
  const theme = useTheme();
  const colors = useFormColors();
  const [isDefault, setIsDefault] = useState<boolean | null>(null);
  const refresh = () => void isDefaultBrowser().then(setIsDefault);
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", refresh);
    return () => sub.remove();
  }, []);
  if (isDefault === null) return <View style={{ height: 20 }} />;
  return (
    <View
      style={{
        marginTop: 20,
        padding: 14,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: colors.group,
        borderWidth: 1,
        borderColor: colors.groupBorder,
      }}
    >
      <Symbol
        name={isDefault ? "checkmark.seal.fill" : "safari"}
        size={20}
        color={isDefault ? "#34C759" : theme.icon}
        style={{ width: 28, height: 28 }}
      />
      <Text style={{ flex: 1, fontSize: 13, color: theme.textPrimary }}>
        {isDefault ? `${APP} 是您的默认浏览器` : `将 ${APP} 设为默认浏览器，使用更便捷`}
      </Text>
      {!isDefault && <Button title={`将 ${APP} 设为默认浏览器`} kind="primary" onPress={() => void setAsDefaultBrowser().then(setIsDefault)} />}
    </View>
  );
}
