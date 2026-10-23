import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { installCliInBackground, useCli } from "../../lib/cliControl";
import { useBrowser } from "../../store/browser";
import { StepLayout } from "./steps";
import { useOnboarding } from "./state";
import { CheckRow, PrimaryButton, Reveal, SecondaryButton, StepTitle, useOnboardingColors } from "./ui";

const MONO = "Menlo";

export function CliStep() {
  const next = useOnboarding((s) => s.next);
  const colors = useOnboardingColors();
  const [control, setControl] = useState(false);
  const [started, setStarted] = useState(false);
  const installing = useCli((s) => !!s.installing);
  const failed = useCli((s) => !s.installing && !!s.error);
  const installed = useCli((s) => !s.installing && !s.error && !!s.installedVersion);

  const install = () => {
    useBrowser.getState().updateSettings({ cliControl: control });
    setStarted(true);
    void installCliInBackground("onboarding");
  };

  const status = !started
    ? null
    : installing
      ? "正在后台安装，你可以继续操作。"
      : failed
        ? "无法下载 ardia 命令。请在“设置 › 高级”中重试。"
        : installed
          ? "安装完成。打开新的终端窗口并运行 ardia --help。"
          : null;

  return (
    <StepLayout
      actions={
        started ? (
          <PrimaryButton title="继续" onPress={next} />
        ) : (
          <>
            <PrimaryButton title="安装" onPress={install} />
            <SecondaryButton title="暂不" onPress={next} />
          </>
        )
      }
      preview={<Terminal />}
    >
      <Reveal delay={60}>
        <StepTitle
          title="从终端操作 Ardia"
          subtitle="ardia 命令可让脚本和编程助手在 Ardia 中打开标签页、点击、输入并读取页面。"
        />
      </Reveal>
      <Reveal delay={140} style={{ gap: 12 }}>
        <CheckRow
          icon="terminal"
          title="允许 ardia 命令控制 Ardia"
          subtitle="退出应用后仍保持启用。可在设置中关闭。"
          value={control}
          disabled={started}
          onChange={setControl}
        />
        <Text style={{ fontSize: 11.5, lineHeight: 16, color: colors.footnote }}>
          {"启用后，命令可打开、读取和操作所有已登录的网页。ardia exec 可运行你提供的任何 Python 代码。"}
        </Text>
        {status ? <Text style={{ fontSize: 12.5, lineHeight: 17, color: colors.subtitle }}>{status}</Text> : null}
      </Reveal>
    </StepLayout>
  );
}

function Terminal() {
  const colors = useOnboardingColors();
  const line = (text: string, color: string) => (
    <Text style={{ fontFamily: MONO, fontSize: 10.5, lineHeight: 17, color }}>{text}</Text>
  );
  return (
    <View
      style={{
        width: 360,
        borderRadius: 10,
        backgroundColor: colors.card,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: colors.rowBorder,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          height: 26,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 10,
          borderBottomWidth: StyleSheet.hairlineWidth * 2,
          borderBottomColor: colors.separator,
        }}
      >
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <View key={c} style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: c }} />
        ))}
        <Text style={{ flex: 1, textAlign: "center", marginRight: 39, fontSize: 11, color: colors.steps }}>zsh</Text>
      </View>
      <View style={{ paddingHorizontal: 12, paddingVertical: 12, gap: 2 }}>
        {line(`$ ardia exec 'await tab.go_to("https://ardia.dev")'`, colors.title)}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          {line("$", colors.title)}
          <View style={{ width: 7, height: 13, marginLeft: 4, backgroundColor: colors.title, opacity: 0.6 }} />
        </View>
      </View>
    </View>
  );
}
