import type { Download } from "./actions";
import { awaitsKeep } from "./downloadMenu";
import { currentT } from "../i18n";

function formatBytes(n: number) {
  if (n < 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1000 && i < units.length - 1) {
    n /= 1000;
    i++;
  }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}

function formatDuration(seconds: number) {
  const t = currentT();
  if (seconds < 60) return t("{count} sec left", { count: Math.max(1, Math.round(seconds)) });
  if (seconds < 3600) return t("{count} min left", { count: Math.round(seconds / 60) });
  return t("{count} hr left", { count: Math.round(seconds / 3600) });
}

export function dangerWarning(d: Download, short = false) {
  const t = currentT();
  if (d.url.startsWith("http:")) return t(short ? "Blocked: not secure" : "Insecure download blocked");
  return t(short ? "Blocked: unsafe file type" : "This type of file can harm your computer");
}

export function downloadStatus(d: Download, exists = true) {
  const t = currentT();
  if (d.state === "finished") return exists ? formatBytes(d.total > 0 ? d.total : d.received) : t("Deleted");
  if (d.state === "failed") return t("Failed to Download");
  if (d.state === "cancelled") return t("Cancelled");
  if (awaitsKeep(d)) return dangerWarning(d);
  const progress = d.total > 0 ? `${formatBytes(d.received)} of ${formatBytes(d.total)}` : formatBytes(d.received);
  if (d.paused) return t("{progress} — Paused", { progress });
  if (d.speed > 0 && d.total > 0) return t("{progress}, {speed}/s — {time}", { progress, speed: formatBytes(d.speed), time: formatDuration((d.total - d.received) / d.speed) });
  return progress;
}
