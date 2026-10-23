import { appIcons, currentAppIcon, setAppearance, setAppIcon, Symbol, type AppIcon } from "@ardia/shell";
import { useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useTheme } from "../../../lib/theme";
import { useBrowser } from "../../../store/browser";
import { tabLayoutOf } from "../../../store/model";
import type { Settings } from "../../../store/settings";
import { useHover } from "../../primitives";
import { SectionHeader, useFormColors } from "../controls";

const MODES: { value: Settings["appearance"]; title: string; description: string }[] = [
  { value: "auto", title: "自动", description: "跟随系统外观设置" },
  { value: "light", title: "浅色", description: "使用浅色应用外观" },
  { value: "dark", title: "深色", description: "使用深色应用外观" },
];

export function AppearancePane() {
  const appearance = useBrowser((s) => s.settings.appearance);
  const choose = (mode: Settings["appearance"]) => {
    useBrowser.getState().updateSettings({ appearance: mode });
    void setAppearance(mode);
  };
  return (
    <View>
      <SectionHeader title="外观主题" description="也可在“显示 › 外观”中设置。无痕窗口始终使用深色。" />
      <View style={{ flexDirection: "row", gap: 14 }}>
        {MODES.map((m) => (
          <ModeChoice key={m.value} mode={m.value} title={m.title} description={m.description} selected={appearance === m.value} onPress={() => choose(m.value)} />
        ))}
      </View>
      <AddressBarPicker />
      <AppIconPicker />
    </View>
  );
}

function AddressBarPicker() {
  const addressBar = useBrowser((s) => s.settings.addressBar);
  const topTabs = useBrowser((s) => tabLayoutOf(s) === "top");
  const choose = (value: Settings["addressBar"]) => useBrowser.getState().updateSettings({ addressBar: value });
  return (
    <>
      <SectionHeader
        title="地址栏"
        description={
          topTabs
            ? "标签页排列在窗口顶部，因此地址栏保留在工具栏中。也可在“显示 › 在侧栏显示地址栏”中设置。"
            : "地址栏放在侧栏时，页面可获得原工具栏占用的高度。侧栏隐藏时，地址栏会回到工具栏。也可在“显示 › 在侧栏显示地址栏”中设置。"
        }
      />
      <View style={{ flexDirection: "row", gap: 14 }}>
        <AddressBarChoice value="toolbar" title="在工具栏中" selected={addressBar !== "sidebar"} onPress={() => choose("toolbar")} />
        <AddressBarChoice value="sidebar" title="在侧栏中" selected={addressBar === "sidebar"} onPress={() => choose("sidebar")} />
      </View>
    </>
  );
}

function AddressBarChoice({ value, title, selected, onPress }: { value: Settings["addressBar"]; title: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  const colors = useFormColors();
  const bar = theme.dark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.16)";
  const field = theme.dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)";
  const page = theme.dark ? "rgba(255,255,255,0.08)" : "#FFFFFF";
  const sidebar = value === "sidebar";
  return (
    <Pressable onPress={onPress} style={{ flex: 1, alignItems: "center", gap: 7 }}>
      <View
        style={{
          width: "100%",
          height: 84,
          borderRadius: 9,
          padding: 6,
          flexDirection: "row",
          gap: 5,
          borderWidth: selected ? 2.5 : 1,
          borderColor: selected ? colors.accent : colors.groupBorder,
          backgroundColor: theme.dark ? "#2A2A2C" : "#E9E9EB",
        }}
      >
        <View style={{ width: "28%", gap: 3, paddingTop: sidebar ? 3 : 8 }}>
          {sidebar && <View style={{ height: 8, borderRadius: 3, marginBottom: 2, backgroundColor: field, borderWidth: 1, borderColor: colors.accent }} />}
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ height: 5, borderRadius: 2.5, backgroundColor: bar }} />
          ))}
        </View>
        <View style={{ flex: 1, borderRadius: 4, backgroundColor: page, overflow: "hidden" }}>
          {!sidebar && (
            <View style={{ height: 13, flexDirection: "row", alignItems: "center", paddingHorizontal: 5, gap: 5, borderBottomWidth: 1, borderBottomColor: field }}>
              <View style={{ width: 14, height: 4, borderRadius: 2, backgroundColor: bar }} />
              <View style={{ flex: 1, height: 7, borderRadius: 2.5, backgroundColor: field, borderWidth: 1, borderColor: colors.accent }} />
            </View>
          )}
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        {selected && <Symbol name="checkmark.circle.fill" size={12} color={colors.accent} style={{ width: 14, height: 14 }} />}
        <Text style={{ fontSize: 12, color: selected ? theme.textPrimary : theme.textSecondary }}>{title}</Text>
      </View>
    </Pressable>
  );
}

function AppIconPicker() {
  const [icons, setIcons] = useState<AppIcon[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    void Promise.all([appIcons(ICON_SIZE), currentAppIcon()]).then(([list, id]) => {
      setIcons(list);
      setCurrent(id);
    });
  }, []);
  if (icons.length < 2) return null;
  const choose = (id: string) => {
    setCurrent(id);
    void setAppIcon(id);
  };
  return (
    <>
      <SectionHeader title="应用图标" description="显示在程序坞和应用切换器中。退出后程序坞仍会保留此图标。" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 6, rowGap: 10 }}>
        {icons.map((icon) => (
          <IconChoice key={icon.id} icon={icon} selected={icon.id === current} onPress={() => choose(icon.id)} />
        ))}
      </View>
    </>
  );
}

const ICON_SIZE = 56;

function IconChoice({ icon, selected, onPress }: { icon: AppIcon; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  const colors = useFormColors();
  const { hovered, hoverProps } = useHover();
  const name = ({ Default: "默认", Midnight: "午夜", Daylight: "日光", Plum: "梅子", Ocean: "海洋", Mono: "黑白", Noir: "墨黑" } as Record<string, string>)[icon.name] ?? icon.name;
  return (
    <Pressable onPress={onPress} {...hoverProps} style={{ width: 72, alignItems: "center", gap: 5 }} tooltip={name}>
      <View
        style={{
          width: 70,
          height: 70,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 2.5,
          borderColor: selected ? colors.accent : "transparent",
          backgroundColor: hovered && !selected ? colors.selected : "transparent",
        }}
      >
        {icon.preview ? <Image source={{ uri: icon.preview }} style={{ width: ICON_SIZE, height: ICON_SIZE }} /> : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        {selected && <Symbol name="checkmark.circle.fill" size={11} color={colors.accent} style={{ width: 13, height: 13 }} />}
        <Text numberOfLines={1} style={{ fontSize: 12, color: selected ? theme.textPrimary : theme.textSecondary }}>
          {name}
        </Text>
      </View>
    </Pressable>
  );
}

function ModeChoice({
  mode,
  title,
  description,
  selected,
  onPress,
}: {
  mode: Settings["appearance"];
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const colors = useFormColors();
  const window = (dark: boolean) => (
    <View style={{ flex: 1, backgroundColor: dark ? "#2B2226" : "#EDE6EA", padding: 6, flexDirection: "row", gap: 5 }}>
      <View style={{ width: "24%", gap: 3, paddingTop: 8 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ height: 5, borderRadius: 2.5, backgroundColor: dark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)" }} />
        ))}
      </View>
      <View style={{ flex: 1, borderRadius: 4, backgroundColor: dark ? "#1A1618" : "#FFFFFF" }} />
    </View>
  );
  return (
    <Pressable onPress={onPress} style={{ flex: 1, alignItems: "center", gap: 7 }} tooltip={description}>
      <View
        style={{
          width: "100%",
          height: 84,
          borderRadius: 9,
          overflow: "hidden",
          flexDirection: "row",
          borderWidth: selected ? 2.5 : 1,
          borderColor: selected ? colors.accent : colors.groupBorder,
        }}
      >
        {mode === "auto" ? (
          <>
            {window(false)}
            {window(true)}
          </>
        ) : (
          window(mode === "dark")
        )}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        {selected && <Symbol name="checkmark.circle.fill" size={12} color={colors.accent} style={{ width: 14, height: 14 }} />}
        <Text style={{ fontSize: 12, color: selected ? theme.textPrimary : theme.textSecondary }}>{title}</Text>
      </View>
    </Pressable>
  );
}
