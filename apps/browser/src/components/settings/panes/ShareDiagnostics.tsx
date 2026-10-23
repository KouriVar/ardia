import { ScrollView, Text, View } from "react-native";
import { useTheme } from "../../../lib/theme";
import { setSharing, useTelemetry } from "../../../telemetry/client";
import { SHARING_COPY, WHATS_SENT } from "../../../telemetry/copy";
import { Button, Group, Row, SectionHeader, Sheet, Toggle } from "../controls";
import { closeSettingsSheet, showSettingsSheet } from "../sheet";

export function ShareDiagnosticsSection() {
  const sharing = useTelemetry((s) => s.sharing);
  return (
    <>
      <SectionHeader title="崩溃报告与使用情况" />
      <Group>
        <Row title={SHARING_COPY.toggle} description={SHARING_COPY.summary}>
          <Toggle value={sharing} onChange={(on) => setSharing(on, "settings")} />
        </Row>
        <Row title={SHARING_COPY.whatsSent} description="查看所有数据字段，以及绝不会离开此 Mac 的内容。" onPress={() => showSettingsSheet(<WhatsSentSheet />)} />
      </Group>
    </>
  );
}

export function WhatsSentSheet() {
  const theme = useTheme();
  return (
    <Sheet width={500} onClose={closeSettingsSheet}>
      <Text style={{ fontSize: 15, fontWeight: "600", color: theme.textPrimary }}>{SHARING_COPY.whatsSent}</Text>
      <Text style={{ fontSize: 12, marginTop: 4, color: theme.textSecondary, lineHeight: 16 }}>
        仅在开启“{SHARING_COPY.toggle}”时发送，“即使关闭共享”所列内容除外。
      </Text>
      <ScrollView style={{ maxHeight: 420, marginTop: 4 }}>
        {WHATS_SENT.map((group) => (
          <View key={group.title}>
            <SectionHeader title={group.title} />
            <Group>
              {group.items.map((item) => (
                <Row key={item} title={<Text style={{ fontSize: 12.5, lineHeight: 17, color: theme.textPrimary }}>{item}</Text>} />
              ))}
            </Group>
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 }}>
        <Text style={{ flex: 1, fontSize: 11.5, lineHeight: 15, color: theme.textTertiary }}>{SHARING_COPY.footnote}</Text>
        <Button title="完成" kind="primary" onPress={closeSettingsSheet} />
      </View>
    </Sheet>
  );
}
