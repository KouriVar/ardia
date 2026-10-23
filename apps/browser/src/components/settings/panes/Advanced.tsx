import { engineInfo, listComponents, WIDEVINE_COMPONENT_ID, type EngineComponent, type EngineInfo } from "@ardia/ardiacore";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { systemInfo } from "@ardia/shell";
import { describeCliInstall, installCliInBackground, useCli } from "../../../lib/cliControl";
import { openUrls } from "../../../lib/actions";
import { useTheme } from "../../../lib/theme";
import { useBrowser } from "../../../store/browser";
import { openInternalPage } from "../../pages/urls";
import type { BatterySaverWhen } from "../../../store/settings";
import { Button, Group, PopUp, Row, SectionHeader, Toggle, useFormColors } from "../controls";

const REPOSITORY = "https://github.com/mantrakp04/ardia";
const SOURCE_NOTICE = "Ardia 使用 Apache License 2.0 开源许可协议。";

const BATTERY_SAVER_DESCRIPTIONS: Record<BatterySaverWhen, string> = {
  lowBattery: "电量不超过 20% 或启用低电量模式时，暂停繁忙的后台标签页并降低动画速度。",
  unplugged: "使用电池或低电量模式时，暂停繁忙的后台标签页并降低动画速度。",
  never: "使用电池时，后台标签页和动画仍以全速运行。",
};

export function AdvancedPane() {
  const theme = useTheme();
  const settings = useBrowser((s) => s.settings);
  const update = useBrowser((s) => s.updateSettings);
  const [info, setInfo] = useState<EngineInfo | null>(null);
  const [widevine, setWidevine] = useState<EngineComponent | null | undefined>(undefined);
  useEffect(() => {
    void engineInfo().then(setInfo).catch(() => {});
    void listComponents()
      .then((list) => setWidevine(list.find((c) => c.id === WIDEVINE_COMPONENT_ID) ?? null))
      .catch(() => setWidevine(null));
  }, []);
  const widevineVersion = widevine && widevine.version !== "0.0.0.0" ? widevine.version : null;

  return (
    <View>
      <SectionHeader title="浏览" />
      <Group>
        <Row title="在地址栏显示完整网址" description="显示完整网址，而非仅显示网站名称。">
          <Toggle value={settings.showFullUrl} onChange={(v) => update({ showFullUrl: v })} />
        </Row>
        <Row title="在个人资料间移动标签页前提醒" description="部分网站数据不会随之转移。">
          <Toggle value={settings.warnBeforeMovingTabsToProfile} onChange={(v) => update({ warnBeforeMovingTabsToProfile: v })} />
        </Row>
        <Row title="显示“导入书签”按钮" description="在空白书签栏上显示。">
          <Toggle value={!settings.hideBookmarksBarImport} onChange={(v) => update({ hideBookmarksBarImport: !v })} />
        </Row>
      </Group>

      <SectionHeader title="性能" />
      <Group>
        <Row title="节能模式" description={BATTERY_SAVER_DESCRIPTIONS[settings.batterySaverWhen]}>
          <PopUp
            value={settings.batterySaverWhen}
            options={[
              { value: "lowBattery", title: "电量低时" },
              { value: "unplugged", title: "未接通电源时" },
              { value: "never", title: "从不" },
            ]}
            onChange={(v) => update({ batterySaverWhen: v })}
            minWidth={190}
          />
        </Row>
      </Group>

      <SectionHeader title="数据" />
      <Group>
        <Row title="历史记录" description="按日期查看您访问过的所有页面。">
          <Button title="显示历史记录" onPress={() => openInternalPage("history")} />
        </Row>
        <Row title="下载" description="您下载的文件及其保存位置。">
          <Button title="显示下载" onPress={() => openInternalPage("downloads")} />
        </Row>
      </Group>

      <CommandLineSection />

      <SectionHeader title="浏览器引擎" />
      <Group>
        <Row title="Chromium" description={info ? "ArdiaCore" : undefined}>
          <Text selectable style={{ fontSize: 13, color: theme.textSecondary }}>
            {info?.chromiumVersion ?? "…"}
          </Text>
        </Row>
        <Row
          title="Widevine（受保护的视频）"
          description={
            widevine === undefined
              ? "正在检查…"
              : widevineVersion
                ? `版本 ${widevineVersion}`
                : "此构建版本不支持：Netflix、Disney+ 等需要此组件的视频将无法播放。"
          }
        />
      </Group>

      <SectionHeader title="源代码与许可协议" />
      <Group>
        <Row title="源代码" description={SOURCE_NOTICE}>
          <Button title="在 GitHub 上查看" onPress={() => openUrls([`${REPOSITORY}/tree/v${systemInfo().appVersion}`])} />
        </Row>
        <Row title="许可协议" description="引擎中各开源组件的版权和许可协议。">
          <Button title="显示许可协议" onPress={() => openUrls(["chrome://credits"])} />
        </Row>
      </Group>
    </View>
  );
}

function CommandLineSection() {
  const theme = useTheme();
  const colors = useFormColors();
  const on = useBrowser((s) => s.settings.cliControl ?? false);
  const update = useBrowser((s) => s.updateSettings);
  const cli = useCli();
  const server = cli.server;
  const serverNote =
    server?.state === "external"
      ? "此实例已通过命令行指定 DevTools 端口，因此此设置不会更改它。"
      : server?.reason
        ? server.reason
        : on && server?.state === "on"
          ? server.connections
            ? `当前已连接：${server.connections} 个会话。`
            : "已开启。当前没有连接。"
          : "开启后，命令可打开、读取并操作您已登录的所有页面；退出后仍保持开启。";
  return (
    <>
      <SectionHeader title="命令行" />
      <Group>
        <Row title="允许 ardia 命令控制 Ardia" description={serverNote}>
          <Toggle value={on} onChange={(v) => update({ cliControl: v })} />
        </Row>
        <Row
          title="ardia 命令"
          description={
            <Text selectable style={{ fontSize: 11.5, marginTop: 2, lineHeight: 15, color: cli.error && !cli.installing ? colors.destructive : theme.textSecondary }}>
              {describeCliInstall(cli)}
            </Text>
          }
        >
          <Button
            title={cli.installing ? "正在安装…" : cli.installedVersion ? "重新安装" : "安装"}
            disabled={!!cli.installing}
            onPress={() => void installCliInBackground("settings")}
          />
        </Row>
      </Group>
    </>
  );
}
