import { appUrlOrigin, displayHost, urlForDisplay } from "@ardia/core";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../lib/theme";
import { SearchField } from "../settings/controls";

export const PAGE_WIDTH = 880;

export function PageHeader({
  title,
  query,
  onQuery,
  placeholder,
  actions,
}: {
  title: string;
  query: string;
  onQuery: (q: string) => void;
  placeholder: string;
  actions?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ height: 64, flexDirection: "row", alignItems: "center", paddingHorizontal: 24, gap: 16 }}>
      <Text style={{ width: 200, fontSize: 22, fontWeight: "600", color: theme.textPrimary }}>{title}</Text>
      <View style={{ flex: 1, alignItems: "center" }}>
        <SearchField value={query} onChangeText={onQuery} placeholder={placeholder} style={{ width: "100%", maxWidth: 480 }} />
      </View>
      <View style={{ width: 200, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>{actions}</View>
    </View>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon?: ReactNode; title: string; subtitle?: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 80, gap: 8 }}>
      {icon}
      <Text style={{ fontSize: 15, fontWeight: "500", color: theme.textSecondary }}>{title}</Text>
      {subtitle ? <Text style={{ fontSize: 13, color: theme.textTertiary, textAlign: "center", maxWidth: 360 }}>{subtitle}</Text> : null}
    </View>
  );
}

const DAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
const MONTHS = ["1 月", "2 月", "3 月", "4 月", "5 月", "6 月", "7 月", "8 月", "9 月", "10 月", "11 月", "12 月"];

export const dayStart = (ms: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

export function dayLabel(start: number, now = Date.now()): string {
  const d = new Date(start);
  const full = `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  const today = dayStart(now);
  if (start === today) return `今天 – ${full}`;
  if (start === dayStart(today - 1)) return `昨天 – ${full}`;
  return full;
}

export function timeLabel(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function hostLabel(url: string): string {
  const app = appUrlOrigin(url);
  if (app) return app;
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#:]+)/i.exec(url);
  return m ? displayHost(m[1]!.toLowerCase()).replace(/^www\./, "") : url;
}

export const queryWords = (query: string) => query.toLowerCase().split(/\s+/).filter(Boolean);

export const searchText = (...fields: string[]) => fields.map((f) => (/xn--/i.test(f) ? `${f} ${urlForDisplay(f)}` : f)).join(" ").toLowerCase();

export function matchesQuery(query: string, ...fields: string[]): boolean {
  const words = queryWords(query);
  if (!words.length) return true;
  const hay = searchText(...fields);
  return words.every((w) => hay.includes(w));
}
