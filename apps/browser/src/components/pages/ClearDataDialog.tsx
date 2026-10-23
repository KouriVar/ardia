import { clearBrowsingData, type BrowsingDataType } from "@ardia/ardiacore";
import { Surface } from "@ardia/shell";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { create } from "zustand";
import { pruneProfileFavicons } from "../../lib/favicons";
import { hex, useTheme } from "../../lib/theme";
import { useBrowser } from "../../store/browser";
import { engineProfile, isIncognitoProfile, profileFor } from "../../store/model";
import { Button, Checkbox, PopUp } from "../settings/controls";

const RANGES = [
  { value: "hour", title: "最近一小时", ms: 3_600_000 },
  { value: "day", title: "最近 24 小时", ms: 86_400_000 },
  { value: "week", title: "最近 7 天", ms: 7 * 86_400_000 },
  { value: "month", title: "最近 4 周", ms: 28 * 86_400_000 },
  { value: "all", title: "全部时间", ms: Infinity },
] as const;
type Range = (typeof RANGES)[number]["value"];

export const useClearDataRequest = create<{ windowId: string | null; request(windowId: string | null): void }>((set) => ({
  windowId: null,
  request: (windowId) => set({ windowId }),
}));

export function ClearDataDialog({ profileId, onClose }: { profileId: string; onClose: () => void }) {
  const theme = useTheme();
  const profileName = useBrowser((s) => profileFor(s, profileId).name);
  const multipleProfiles = useBrowser((s) => s.profileOrder.length > 1);
  const [range, setRange] = useState<Range>("hour");
  const [history, setHistory] = useState(true);
  const [siteData, setSiteData] = useState(true);
  const [busy, setBusy] = useState(false);

  const clear = async () => {
    setBusy(true);
    const ms = RANGES.find((r) => r.value === range)!.ms;
    const since = ms === Infinity ? undefined : Date.now() - ms;
    if (history) {
      useBrowser.getState().clearHistory(profileId, since);
      pruneProfileFavicons(profileId);
    }
    const types: BrowsingDataType[] = [...(history ? ["history" as const] : []), ...(siteData ? ["siteData" as const, "cache" as const] : [])];
    if (types.length && !isIncognitoProfile(profileId)) await clearBrowsingData(engineProfile(profileId), types, since);
    setBusy(false);
    onClose();
  };

  return (
    <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: theme.dark ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.15)" }]} onPress={onClose} />
      <Surface
        fill={hex(theme.panel)}
        cornerRadius={14}
        borderColor={hex(theme.panelBorder)}
        borderWidth={0.5}
        shadowColor="#000000"
        shadowOpacity={theme.panelShadowOpacity}
        shadowRadius={30}
        shadowOffset={[0, 12]}
        style={{ width: 440, padding: 20 }}
      >
        <Text style={{ fontSize: 15, fontWeight: "600", color: theme.textPrimary }}>清除浏览数据</Text>
        {multipleProfiles && <Text style={{ fontSize: 12, marginTop: 4, color: theme.textSecondary }}>{`来自 ${profileName} 个人资料`}</Text>}
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 16, gap: 10 }}>
          <Text style={{ fontSize: 13, color: theme.textPrimary }}>时间范围</Text>
          <PopUp value={range} options={RANGES.map(({ value, title }) => ({ value, title }))} onChange={setRange} minWidth={150} />
        </View>
        <View style={{ marginTop: 16, gap: 12 }}>
          <Option value={history} onChange={setHistory} title="浏览历史记录" subtitle="清除历史记录和命令栏中的已访问页面。" />
          <Option
            value={siteData}
            onChange={setSiteData}
            title="Cookie、网站数据和缓存文件"
            subtitle="会退出大多数网站的登录。"
          />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 22 }}>
          <Button title="取消" onPress={onClose} />
          <Button title="清除数据" kind="primary" disabled={busy || (!history && !siteData)} onPress={() => void clear()} />
        </View>
      </Surface>
    </View>
  );
}

function Option({ value, onChange, title, subtitle }: { value: boolean; onChange: (v: boolean) => void; title: string; subtitle: string }) {
  const theme = useTheme();
  return (
    <View>
      <Checkbox value={value} onChange={onChange} label={title} />
      <Text style={{ fontSize: 11.5, marginLeft: 21, marginTop: 2, color: theme.textSecondary }}>{subtitle}</Text>
    </View>
  );
}
