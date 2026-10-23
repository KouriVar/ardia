import type { SystemCalendar } from "@ardia/shell";
import { Linking, Text, View } from "react-native";
import { useTheme } from "../../../lib/theme";
import { connectCalendar, setCalendarHidden, useCalendar } from "../../../live/calendar";
import { ALERT_LEADS } from "../../../live/meetings";
import { updateCalendarSettings, useLive } from "../../../live/store";
import { useBrowser } from "../../../store/browser";
import { Button, Checkbox, Group, PopUp, Row, SectionHeader, Toggle } from "../controls";

export function CalendarPane() {
  const theme = useTheme();
  const settings = useLive((s) => s.calendar);
  const { access, calendars } = useCalendar();
  const autoGroup = useBrowser((s) => s.settings.autoGroupMeetingTabs);
  const connected = access === "fullAccess" || access === "fixture";
  const denied = access === "denied" || access === "restricted";
  const owned = calendars.filter((c) => c.owned);
  const others = calendars.filter((c) => !c.owned);

  return (
    <View>
      <SectionHeader
        title="动态日历"
        description="固定 Google 日历、Outlook、iCloud 或 Notion Calendar 后，悬停可查看当日日程，并显示下一场会议倒计时及带有“加入”按钮的会前提醒。日程来自“日历”应用中的账户。"
      />
      <Group>
        <Row
          title="日历访问权限"
          description={
            access === "fixture"
              ? "开发构建：使用 calendar-fixture.json"
              : connected
                ? `已连接 · ${calendars.length} 个日历`
                : denied
                  ? "Ardia 无权读取您的日历。请前往“系统设置 › 隐私与安全性 › 日历”授予权限。"
                  : "未连接"
          }
        >
          {denied ? (
            <Button title="打开系统设置" onPress={() => void Linking.openURL("x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars")} />
          ) : !connected ? (
            <Button title="连接日历…" kind="primary" onPress={() => void connectCalendar()} />
          ) : null}
        </Row>
      </Group>

      <SectionHeader title="会议提醒" />
      <Group>
        <Row title="显示下一场会议提醒">
          <PopUp value={settings.alertLead} options={ALERT_LEADS.map((l) => ({ value: l.value, title: l.title, separatorBefore: l.value === "start" }))} onChange={(v) => updateCalendarSettings({ alertLead: v })} minWidth={170} />
        </Row>
        <Row title="显示提醒" description="选择“始终”后，在使用其他应用时也会在通知中心显示提醒。">
          <PopUp
            value={settings.alertCondition}
            options={[
              { value: "always", title: "始终" },
              { value: "activeOnly", title: "仅在应用活跃时" },
            ]}
            disabled={settings.alertLead === "never"}
            onChange={(v) => updateCalendarSettings({ alertCondition: v })}
            minWidth={170}
          />
        </Row>
      </Group>

      <SectionHeader title="固定的日历" />
      <Group>
        <Row title="显示日历预览" description="悬停在固定的日历标签页上，可查看当天剩余日程。">
          <Toggle value={settings.showPreview} onChange={(v) => updateCalendarSettings({ showPreview: v })} />
        </Row>
        <Row title="显示距下次会议的时间" description="会议开始前一小时内，在固定日历标签页上显示标记。">
          <Toggle value={settings.showTimeToNext} onChange={(v) => updateCalendarSettings({ showTimeToNext: v })} />
        </Row>
      </Group>

      <SectionHeader title="会议" />
      <Group>
        <Row title="自动将会议标签页分组" description="加入通话时为其创建标签页分组；从会议中打开的链接会加入此分组。">
          <Toggle value={autoGroup} onChange={(v) => useBrowser.getState().updateSettings({ autoGroupMeetingTabs: v })} />
        </Row>
      </Group>

      {calendars.length ? (
        <>
          <SectionHeader title="启用的日历" description="未勾选日历中的会议不会显示或提醒。" />
          <Group>
            {owned.length ? <CalendarList title="我的日历" calendars={owned} hidden={settings.hiddenCalendarIds} /> : null}
            {others.length ? <CalendarList title="其他日历" calendars={others} hidden={settings.hiddenCalendarIds} /> : null}
          </Group>
        </>
      ) : connected ? (
        <Text style={{ marginTop: 12, fontSize: 12, color: theme.textSecondary }}>未找到日历。请在“日历”应用中添加账户。</Text>
      ) : null}
    </View>
  );
}

function CalendarList({ title, calendars, hidden }: { title: string; calendars: SystemCalendar[]; hidden: string[] }) {
  const theme = useTheme();
  return (
    <View style={{ paddingVertical: 6 }}>
      <Text style={{ fontSize: 11, fontWeight: "600", color: theme.textSecondary, marginLeft: 12, marginBottom: 2 }}>{title}</Text>
      {calendars.map((c) => (
        <Row
          key={c.id}
          icon={<View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c.color }} />}
          title={<Checkbox value={!hidden.includes(c.id)} onChange={(v) => setCalendarHidden(c.id, !v)} label={c.title} />}
          description={c.account}
        />
      ))}
    </View>
  );
}
