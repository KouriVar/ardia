import { translateActive } from "./i18n/active";

const counted = (count: number, singular: string, plural: string) =>
  translateActive(count === 1 ? `1 ${singular} ago` : `{count} ${plural} ago`, { count });

export function ago(at: number, now = Date.now()): string {
  const s = Math.max(0, (now - at) / 1000);
  if (s < 60) return translateActive("just now");
  const m = Math.floor(s / 60);
  if (m < 60) return counted(m, "minute", "minutes");
  const h = Math.floor(m / 60);
  if (h < 24) return counted(h, "hour", "hours");
  const d = Math.floor(h / 24);
  if (d === 1) return translateActive("yesterday");
  if (d < 7) return counted(d, "day", "days");
  if (d < 30) return counted(Math.floor(d / 7), "week", "weeks");
  if (d < 365) return counted(Math.floor(d / 30), "month", "months");
  return counted(Math.floor(d / 365), "year", "years");
}

export type DurationUnit = "minutes" | "hours" | "days";

const MINUTES_PER: Record<DurationUnit, number> = { minutes: 1, hours: 60, days: 1440 };

export const MAX_DURATION_MINUTES = 365 * MINUTES_PER.days;

export function durationParts(minutes: number): { amount: number; unit: DurationUnit } {
  if (minutes % MINUTES_PER.days === 0) return { amount: minutes / MINUTES_PER.days, unit: "days" };
  if (minutes % MINUTES_PER.hours === 0) return { amount: minutes / MINUTES_PER.hours, unit: "hours" };
  return { amount: minutes, unit: "minutes" };
}

export function durationTitle(minutes: number): string {
  const { amount, unit } = durationParts(minutes);
  return `${amount} ${translateActive(amount === 1 ? unit.slice(0, -1) : unit)}`;
}

export function durationMinutes(amount: string, unit: DurationUnit): number | null {
  const text = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const minutes = Math.round(Number(text) * MINUTES_PER[unit]);
  return minutes >= 1 && minutes <= MAX_DURATION_MINUTES ? minutes : null;
}
