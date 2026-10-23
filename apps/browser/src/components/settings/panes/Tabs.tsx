import { Symbol } from "@ardia/shell";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../../../lib/theme";
import { useBrowser } from "../../../store/browser";
import { tabLayoutOf } from "../../../store/model";
import type { Settings } from "../../../store/settings";
import { Checkbox, Group, PopUp, Row, SectionHeader, Toggle, useFormColors } from "../controls";

const CLEAN_UP = [
  { value: "12", title: "12 小时" },
  { value: "24", title: "24 小时" },
  { value: "168", title: "7 天" },
  { value: "720", title: "30 天" },
];

export function TabsPane() {
  const settings = useBrowser((s) => s.settings);
  const update = useBrowser((s) => s.updateSettings);
  const toggle = (key: keyof Settings, title: string, description?: string) => (
    <Row key={key} title={title} description={description}>
      <Toggle value={!!settings[key]} onChange={(v) => update({ [key]: v })} />
    </Row>
  );
  const top = useBrowser((s) => tabLayoutOf(s) === "top");

  return (
    <View>
      <SectionHeader title="标签页布局" />
      <View style={{ flexDirection: "row", gap: 14 }}>
        <LayoutChoice layout="sidebar" title="标签页排列在侧栏中" selected={!top} />
        <LayoutChoice layout="top" title="标签页排列在窗口顶部" selected={top} />
      </View>
      <Group style={{ marginTop: 14 }}>
        {toggle(
          "hideToolbarWhileScrolling",
          "滚动时隐藏工具栏",
          "向下滚动时，工具栏会收起为显示网站名称的细条。向上滚动或点击细条即可展开。",
        )}
        {!top && toggle("showSidebarButton", "显示侧栏按钮", "仍可使用 ⌘S 或“显示 › 自动隐藏标签页”来隐藏或显示侧栏。")}
      </Group>

      <SectionHeader title="通用" />
      <Group>
        <Row
          title="新建标签页时打开"
          description="选择命令栏后，⌘T 和“新建标签页”会像 Arc 一样在页面上方打开命令栏。选中结果后才会创建标签页；按 Esc 可取消。"
        >
          <PopUp
            value={settings.newTabOpens}
            options={[
              { value: "page", title: "新标签页" },
              { value: "commandBar", title: "命令栏" },
            ]}
            onChange={(v) => update({ newTabOpens: v })}
            minWidth={160}
          />
        </Row>
        <Row title={top ? "在左侧添加新标签页" : "在顶部添加新标签页"}>
          <Toggle value={settings.newTabPosition === "top"} onChange={(v) => update({ newTabPosition: v ? "top" : "bottom" })} />
        </Row>
        {toggle("warnBeforeClosingLastTab", "关闭个人资料中的最后一个标签页前提醒")}
        {toggle("tabReorderHaptics", "调整标签页顺序时提供触觉反馈")}
        {toggle("extendWebsiteColor", "将网站颜色延伸至标签栏")}
        {toggle(
          "sidebarMediaControls",
          "在侧栏显示媒体控制",
          "后台标签页播放声音时，播放器会出现在侧栏底部。将指针移到正在播放的固定标签页上，也会显示播放器。",
        )}
        {toggle("autoPictureInPicture", "自动画中画", "切换标签页或离开窗口时，正在观看的视频或通话会弹出；返回时会自动还原。")}
        {toggle(
          "videoUpscaling",
          "视频超分辨率",
          "在 Apple 芯片上，增强放大播放的低分辨率视频清晰度。仅用于当前标签页；后台、低电量模式或 Mac 过热时停用。",
        )}
      </Group>

      <SectionHeader title="标签页分组" />
      <Group>
        {toggle("cmdClickCreatesTabGroup", "按住 ⌘ 点击链接时创建标签页分组")}
        {toggle("optShiftClickOpensInGroup", "按住 ⌥⇧ 点击时在分组中打开标签页", "按住 ⌥⇧ 点击标签页可将其与当前标签页组成一组。（按住 ⌥⇧ 点击链接可在分屏中打开。）")}
        {toggle("autoGroupMeetingTabs", "自动将会议标签页分组")}
      </Group>

      <SectionHeader
        title="清理"
        description="自动关闭闲置和重复标签页，与标签页菜单中的“每日清理”相同。固定、正在播放和选中的标签页会保留；已清理标签页列在“最近清理”中。"
      />
      <Group>
        <Row title={<Checkbox value={settings.cleanUpInactiveTabsAfterHours !== null} onChange={(v) => update({ cleanUpInactiveTabsAfterHours: v ? 24 : null })} label="清理超过以下时间未使用的标签页：" />}>
          <PopUp
            value={String(settings.cleanUpInactiveTabsAfterHours ?? 24)}
            options={CLEAN_UP}
            disabled={settings.cleanUpInactiveTabsAfterHours === null}
            onChange={(v) => update({ cleanUpInactiveTabsAfterHours: Number(v) })}
          />
        </Row>
      </Group>
    </View>
  );
}

function LayoutChoice({ layout, title, selected }: { layout: "sidebar" | "top"; title: string; selected: boolean }) {
  const theme = useTheme();
  const colors = useFormColors();
  const choose = () => {
    const s = useBrowser.getState();
    s.updateSettings({ tabLayout: layout });
    for (const w of Object.values(s.windows)) {
      if ((w.tabLayout ?? s.settings.tabLayout) !== layout) useBrowser.getState().toggleTabLayout(w.id);
    }
    useBrowser.getState().updateSettings({ tabLayout: layout });
  };
  const bar = theme.dark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.16)";
  const page = theme.dark ? "rgba(255,255,255,0.08)" : "#FFFFFF";
  return (
    <Pressable onPress={choose} style={{ flex: 1, alignItems: "center", gap: 8 }}>
      <View
        style={{
          width: "100%",
          height: 104,
          borderRadius: 10,
          padding: 8,
          borderWidth: selected ? 2.5 : 1,
          borderColor: selected ? colors.accent : colors.groupBorder,
          backgroundColor: theme.dark ? "#2A2A2C" : "#E9E9EB",
          flexDirection: layout === "sidebar" ? "row" : "column",
          gap: 5,
        }}
      >
        {layout === "sidebar" ? (
          <View style={{ width: "26%", gap: 4, paddingTop: 10 }}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ height: 7, borderRadius: 3, backgroundColor: i === 1 ? colors.accent : bar }} />
            ))}
          </View>
        ) : (
          <View style={{ height: 10, flexDirection: "row", gap: 4, paddingLeft: 26 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ flex: 1, borderRadius: 3, backgroundColor: i === 1 ? colors.accent : bar }} />
            ))}
          </View>
        )}
        <View style={{ flex: 1, borderRadius: 5, backgroundColor: page }} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        {selected && <Symbol name="checkmark.circle.fill" size={12} color={colors.accent} style={{ width: 14, height: 14 }} />}
        <Text style={{ fontSize: 12, color: selected ? theme.textPrimary : theme.textSecondary }}>{title}</Text>
      </View>
    </Pressable>
  );
}
