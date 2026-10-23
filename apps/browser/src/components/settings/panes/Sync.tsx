import { showMenu, Symbol } from "@ardia/shell";
import { SyncNative, type FolderInfo } from "@ardia/sync";
import { useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import { useTheme } from "../../../lib/theme";
import { useBrowser } from "../../../store/browser";
import { useProfiles } from "../../../store/hooks";
import {
  addRemoteProfile,
  chooseSyncFolder,
  DATA_TYPES,
  folderInfo,
  setProfileSynced,
  setTypeSynced,
  syncNow,
  turnOnSync,
  useSync,
  type SyncStatus,
} from "../../../sync/engine";
import { ProfileBadge } from "../../profiles/icons";
import { Button, Group, Row, SectionHeader, Toggle, useFormColors } from "../controls";
import { folderLabel, showConnectDevice, showPhraseEntry, showRecoveryKit, showStopSync } from "./SyncSheets";

export function SyncPane() {
  const theme = useTheme();
  const enabled = useSync((s) => s.enabled);
  const status = useSync((s) => s.status);
  const folder = useSync((s) => s.folder);
  const [info, setInfo] = useState<FolderInfo | null>(null);
  useEffect(() => {
    let live = true;
    void folderInfo(folder).then((i) => live && setInfo(i));
    return () => {
      live = false;
    };
  }, [folder, enabled, status]);

  if (status === "unavailable") {
    return <Text style={{ marginTop: 20, fontSize: 12.5, color: theme.textSecondary }}>此构建版本不支持同步。</Text>;
  }
  return (
    <View>
      <Text style={{ marginTop: 20, fontSize: 12.5, lineHeight: 17, color: theme.textSecondary }}>
        在多台 Mac 间同步个人资料、书签、历史记录、已打开和固定的标签页、分组、密码、扩展及设置。所有内容都通过您选择的文件夹（如 iCloud 云盘）同步，并进行端到端加密：只有您的设备可以读取。
      </Text>
      {enabled ? <SyncOn info={info} /> : <SyncOff info={info} />}
    </View>
  );
}

function SyncIcon({ on }: { on: boolean }) {
  const colors = useFormColors();
  const theme = useTheme();
  return (
    <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.accent : colors.control, borderWidth: on ? 0 : 1, borderColor: colors.controlBorder }}>
      <Symbol name="arrow.triangle.2.circlepath" size={13} weight="semibold" color={on ? "#FFFFFF" : theme.icon} style={{ width: 28, height: 28 }} />
    </View>
  );
}

function SyncOff({ info }: { info: FolderInfo | null }) {
  const theme = useTheme();
  const colors = useFormColors();
  const status = useSync((s) => s.status);
  const error = useSync((s) => s.error);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const noICloud = !!info && info.path === info.defaultPath && !info.iCloudAvailable;
  const hasData = !!info?.hasSyncData;

  const turnOn = async () => {
    if (!info) return;
    setBusy(true);
    setFailure(null);
    const result = await turnOnSync(info.path);
    setBusy(false);
    if ("error" in result) setFailure(result.error);
    else showRecoveryKit();
  };
  const enterPhrase = () => showPhraseEntry(info, () => void chooseSyncFolder().then(() => folderInfo().then((i) => showPhraseEntry(i))));
  const otherOptions = async () => {
    const choice = await showMenu([
      { id: "new", title: "不通过其他设备设置", enabled: !noICloud },
      { id: "phrase", title: "输入恢复短语" },
    ]);
    if (choice === "new") void turnOn();
    else if (choice === "phrase") enterPhrase();
  };

  return (
    <>
      <Group style={{ marginTop: 18 }}>
        <Row
          icon={<SyncIcon on={false} />}
          title="同步"
          description={
            status === "reset" && error
              ? error
              : hasData
                ? "此文件夹已有同步数据。要与其他设备同步，请输入其中一台设备的恢复短语。"
                : "关闭"
          }
        >
          {hasData ? (
            <>
              <Button title="其他选项" onPress={() => void otherOptions()} />
              <Button title="输入恢复短语…" kind="primary" onPress={enterPhrase} />
            </>
          ) : (
            <>
              <Button title="输入恢复短语…" onPress={enterPhrase} disabled={noICloud} />
              <Button title={busy ? "正在开启…" : "开启同步"} kind="primary" disabled={busy || noICloud || !info} onPress={() => void turnOn()} />
            </>
          )}
        </Row>
        <Row title="同步文件夹" description={info ? folderLabel(info) : " "}>
          <Button title="选择…" onPress={() => void chooseSyncFolder()} />
        </Row>
        {noICloud ? (
          <Row
            icon={<Symbol name="exclamationmark.icloud" size={14} color="#FF9500" style={{ width: 28, height: 20 }} />}
            title="此 Mac 未开启 iCloud 云盘"
            description="在系统设置中开启 iCloud 云盘，或选择可在 Mac 之间同步的其他文件夹，如 Dropbox、NAS 或 USB 驱动器上的文件夹。"
          >
            <Button title="打开 iCloud 设置" onPress={() => void Linking.openURL("x-apple.systempreferences:com.apple.preferences.AppleIDPrefPane")} />
          </Row>
        ) : null}
      </Group>
      {failure ? <Text style={{ marginTop: 8, fontSize: 12, color: colors.destructive }}>{failure}</Text> : null}
      <Text style={{ marginTop: 12, fontSize: 11.5, lineHeight: 15, color: theme.textTertiary }}>
        无需服务器或账户：各台 Mac 通过同步文件夹交换数据。恢复短语绝不离开您的设备；没有它，文件夹中的所有内容（包括文件名）都无法读取。
      </Text>
    </>
  );
}

function statusLine(status: SyncStatus, lastSyncedAt: number | null, pending: number): string {
  const since = lastSyncedAt ? ago(lastSyncedAt) : null;
  const line = (() => {
    switch (status) {
      case "starting":
        return "正在启动";
      case "updating":
        return "updating";
      case "offline":
        return "offline";
      case "stalled":
      case "locked":
        return since ? `未同步 · 上次同步于${since}` : "未同步";
      default:
        return since && since !== "刚刚" ? `${since}更新` : "刚刚更新";
    }
  })();
  return pending ? `${line} · 正在等待下载 ${pending} 个文件` : line;
}

function SyncOn({ info }: { info: FolderInfo | null }) {
  const theme = useTheme();
  const colors = useFormColors();
  const status = useSync((s) => s.status);
  const lastSyncedAt = useSync((s) => s.lastSyncedAt);
  const pending = useSync((s) => s.pending);
  const error = useSync((s) => s.error);
  const types = useSync((s) => s.types);
  const links = useSync((s) => s.profiles);
  const devices = useSync((s) => s.devices);
  const remoteProfiles = useSync((s) => s.remoteProfiles);
  const profiles = useProfiles();
  const allProfiles = useBrowser((s) => s.profiles);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const advanced = async () => {
    const choice = await showMenu([
      { id: "kit", title: "保存恢复套件…", symbol: "arrow.down.doc" },
      { id: "copy", title: "复制恢复代码", symbol: "doc.on.doc" },
      { separator: true },
      { id: "now", title: "立即同步", symbol: "arrow.triangle.2.circlepath" },
      { id: "reveal", title: "在访达中显示同步文件夹", symbol: "folder", enabled: !!info?.exists },
      { separator: true },
      { id: "stop", title: "停止同步…", symbol: "xmark.circle" },
    ]);
    if (choice === "kit") showRecoveryKit();
    else if (choice === "copy") await SyncNative?.copyRecoveryPhrase();
    else if (choice === "now") await syncNow();
    else if (choice === "reveal" && info) await SyncNative?.revealFolder(info.path);
    else if (choice === "stop") showStopSync();
  };

  const locked = status === "locked";
  return (
    <>
      <Group style={{ marginTop: 18 }}>
        <Row icon={<SyncIcon on={!locked} />} title="同步" description={statusLine(status, lastSyncedAt, pending)}>
          {locked ? (
            <Button title="输入恢复短语…" kind="primary" onPress={() => showPhraseEntry(info)} />
          ) : (
            <Button title="连接另一台设备…" onPress={showConnectDevice} />
          )}
          <Button title="高级…" onPress={() => void advanced()} />
        </Row>
        <Row title="同步文件夹" description={info ? folderLabel(info) : " "} />
      </Group>
      {error && status !== "updated" ? (
        <View style={{ flexDirection: "row", gap: 6, marginTop: 8, paddingHorizontal: 2 }}>
          <Symbol name="exclamationmark.circle.fill" size={11} color={colors.destructive} style={{ width: 14, height: 15 }} />
          <Text style={{ flex: 1, fontSize: 11.5, lineHeight: 15, color: theme.textSecondary }}>{error}</Text>
        </View>
      ) : null}

      <SectionHeader title="个人资料" description="选择在此 Mac 上同步的个人资料。每份个人资料独立同步。" />
      <Group>
        {profiles.map((p) => {
          const link = links[p.id];
          const owner = p.dataId ? allProfiles[p.dataId] : undefined;
          return (
            <Row
              key={p.id}
              icon={<ProfileBadge profile={p} size={24} />}
              title={p.name}
              description={owner ? `与 ${owner.name} 共享数据：标签页同步到此处，数据与 ${owner.name} 同步。` : undefined}
            >
              <Toggle value={!!link?.enabled} disabled={!link} onChange={(on) => setProfileSynced(p.id, on)} />
            </Row>
          );
        })}
        {remoteProfiles.map((p) => (
          <Row key={p.syncId} icon={<ProfileBadge profile={{ name: p.name, color: p.color, icon: p.icon }} size={24} />} title={p.name} description={remoteProfileDescription(p)}>
            <Button title="添加到此 Mac" disabled={!!p.waiting} onPress={() => addRemoteProfile(p.syncId)} />
          </Row>
        ))}
      </Group>

      <SectionHeader title="同步内容" />
      <Group>
        {DATA_TYPES.map((t) => (
          <Row key={t.id} title={t.title} description={t.description}>
            <Toggle value={types[t.id]} onChange={(on) => setTypeSynced(t.id, on)} />
          </Row>
        ))}
      </Group>

      <SectionHeader title="设备" />
      <Group>
        {devices.length ? (
          devices.map((d) => (
            <Row
              key={d.id}
              icon={<Symbol name="laptopcomputer" size={15} color={theme.icon} style={{ width: 24, height: 20 }} />}
              title={d.current ? `${d.name}（此 Mac）` : d.name}
              description={d.current ? statusLine(status, lastSyncedAt, 0) : d.lastSeen ? `上次同步于${ago(d.lastSeen)}` : "尚未同步"}
            />
          ))
        ) : (
          <Row title="目前只有此 Mac" description="其他设备同步后会显示在这里。" />
        )}
      </Group>
    </>
  );
}

function remoteProfileDescription(p: { sharesWith?: { name: string; added: boolean }; waiting?: true }): string {
  if (p.waiting) return "在您的其他设备上。正在等待共享数据的个人资料同步。";
  if (!p.sharesWith) return "在您的其他设备上";
  const { name, added } = p.sharesWith;
  return added ? `在您的其他设备上。与 ${name} 共享数据；添加时也会加入该个人资料。` : `在您的其他设备上。与 ${name} 共享数据。`;
}

export function ago(at: number, now = Date.now()): string {
  const s = Math.max(0, (now - at) / 1000);
  if (s < 60) return "刚刚";
  const m = Math.floor(s / 60);
  if (m < 60) return m === 1 ? "1 分钟前" : `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return h === 1 ? "1 小时前" : `${h} 小时前`;
  const d = Math.floor(h / 24);
  return d === 1 ? "昨天" : `${d} 天前`;
}
