import {
  deletePassword,
  exportPasswords,
  getNeverSavePasswordOrigins,
  getPassword,
  getPasswordAutofill,
  listPasswords,
  savePassword,
  setNeverSavePasswords,
  setPasswordAutofill,
  unlockPasswords,
  updatePassword,
  type SavedPassword,
} from "@ardia/ardiacore";
import { confirm, copyText, Symbol, systemInfo } from "@ardia/shell";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../../lib/theme";
import { useBrowser } from "../../../store/browser";
import { useProfiles } from "../../../store/hooks";
import { engineProfile } from "../../../store/model";
import { importModule } from "../../import/module";
import { hostLabel, matchesQuery } from "../../pages/PageLayout";
import { Favicon, IconButton } from "../../primitives";
import { Button, Group, PopUp, Row, SearchField, SectionHeader, Sheet, TextField, Toggle } from "../controls";
import { closeSettingsSheet, showSettingsSheet } from "../sheet";

function passwordManagerAppsNote() {
  const apps = "1Password、Bitwarden、KeePassXC 和 Proton Pass 扩展可连接各自的 Mac 应用。";
  return systemInfo().inApplicationsFolder === false
    ? `${apps} 使用 1Password 时，请将 Ardia 移入“应用程序”文件夹并重新打开（1Password 仅连接该位置的浏览器），然后在 1Password 的“设置 › 浏览器 › 添加浏览器”中选择它。`
    : `${apps} 使用 1Password 时，只需添加一次 Ardia：打开 1Password 的“设置 › 浏览器 › 添加浏览器”，选择 Ardia。`;
}

const UNLOCK_MS = 5 * 60_000;
const unlockedUntil = new Map<string, number>();
const isUnlocked = (profile: string) => Date.now() < (unlockedUntil.get(profile) ?? 0);

export function PasswordsPane({ profileId: initial }: { profileId?: string | null }) {
  const theme = useTheme();
  const profiles = useProfiles();
  const [profileId, setProfileId] = useState(() => initial ?? useBrowser.getState().settings.defaultProfileId);
  const [, setUnlockedAt] = useState(0);
  const [list, setList] = useState<SavedPassword[] | null>(null);
  const [never, setNever] = useState<string[]>([]);
  const [autofill, setAutofill] = useState(true);
  const [query, setQuery] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const profile = engineProfile(profileId);
  const unlocked = isUnlocked(profile);

  const load = () => {
    void listPasswords(profile).then(setList).catch(() => setList([]));
    void getNeverSavePasswordOrigins(profile).then(setNever).catch(() => {});
  };
  useEffect(() => {
    if (unlocked) load();
  }, [unlocked, profileId]);
  useEffect(() => void getPasswordAutofill(profile).then(setAutofill).catch(() => {}), [profile]);

  const unlock = async () => {
    if (!(await unlockPasswords(profile))) return;
    unlockedUntil.set(profile, Date.now() + UNLOCK_MS);
    setUnlockedAt(Date.now());
  };

  const importCsv = async () => {
    const mod = importModule();
    if (!mod) return setImportStatus("此构建版本不支持导入。");
    const path = await mod.chooseImportFile("passwordsCSV");
    if (!path) return;
    try {
      const creds = await mod.importPasswordsCSV(path);
      let saved = 0;
      for (const c of creds) if (c.url && c.password && (await savePassword(profile, originOf(c.url), c.username, c.password))) saved++;
      setImportStatus(`已导入 ${saved} 个密码。`);
      load();
    } catch (e) {
      setImportStatus(`无法导入此文件：${(e as Error).message}`);
    }
  };

  const exportCsv = async () => {
    const { status, path } = await exportPasswords(profile);
    const folder = path ? path.split("/").slice(-2, -1)[0] : "";
    if (status === "succeeded") setExportStatus(`已保存到“${folder}”。使用完毕后请删除该文件。`);
    else if (status === "writeFailed") setExportStatus("无法写入文件。请尝试其他文件夹。");
    else if (status === "inProgress") setExportStatus("已有导出任务正在运行。");
    else setExportStatus("");
  };

  const shown = (list ?? []).filter((p) => matchesQuery(query, p.origin, p.username));

  return (
    <View>
      <SectionHeader
        title="密码"
        description="按个人资料分别保存在此 Mac 上，并使用钥匙串中的密钥加密。"
        action={
          profiles.length > 1 ? (
            <PopUp value={profileId} options={profiles.map((p) => ({ value: p.id, title: p.name }))} onChange={setProfileId} />
          ) : undefined
        }
      />
      <Group>
        <Row title="提示保存并填充密码" description="登录后提示保存登录信息；点击登录输入框时建议已保存的登录信息。">
          <Toggle value={autofill} onChange={(v) => void setPasswordAutofill(v, profile).then(() => setAutofill(v))} />
        </Row>
        <Row title="导入密码" description={importStatus || "从 Chrome、Safari、Firefox、1Password、Bitwarden 等导出的 CSV 文件中导入。"}>
          <Button title="导入 CSV…" onPress={() => void importCsv()} />
        </Row>
        <Row title="导出密码" description={exportStatus || "导出为 CSV 文件。任何能打开此文件的人都可以读取您的密码。"}>
          <Button title="导出 CSV…" onPress={() => void exportCsv()} />
        </Row>
        <Row title="密码管理器应用" description={passwordManagerAppsNote()} />
      </Group>

      {!unlocked ? (
        <View style={{ alignItems: "center", gap: 10, marginTop: 40 }}>
          <Symbol name="lock.fill" size={26} color={theme.textTertiary} style={{ width: 36, height: 36 }} />
          <Text style={{ fontSize: 14, fontWeight: "500", color: theme.textPrimary }}>密码已锁定</Text>
          <Text style={{ fontSize: 12, color: theme.textSecondary }}>使用触控 ID 或登录密码解锁后查看。</Text>
          <Button title="解锁" kind="primary" onPress={() => void unlock()} style={{ marginTop: 6 }} />
        </View>
      ) : (
        <>
          <SectionHeader title={list ? `已保存的密码（${list.length}）` : "已保存的密码"} action={<SearchField value={query} onChangeText={setQuery} placeholder="搜索" width={200} />} />
          <Group>
            {list && shown.length === 0 ? (
              <Row title={query ? "没有匹配的密码" : "没有已保存的密码"} />
            ) : (
              shown.map((p) => (
                <Row
                  key={`${p.origin}|${p.username}`}
                  icon={<Favicon url={p.origin} />}
                  title={hostLabel(p.origin)}
                  description={p.username || "（无用户名）"}
                  onPress={() => showSettingsSheet(<PasswordSheet profile={profile} saved={p} onChanged={load} />)}
                />
              ))
            )}
          </Group>
          {never.length > 0 && (
            <>
              <SectionHeader title="不保存密码的网站" description="您选择了“永不为此网站保存”的网站。" />
              <Group>
                {never.map((origin) => (
                  <Row key={origin} icon={<Favicon url={origin} />} title={hostLabel(origin)}>
                    <Button title="移除" onPress={() => void setNeverSavePasswords(profile, origin, false).then(load)} />
                  </Row>
                ))}
              </Group>
            </>
          )}
        </>
      )}
    </View>
  );
}

function originOf(url: string) {
  const m = /^([a-z][a-z0-9+.-]*:\/\/[^/?#]+)/i.exec(url);
  return m ? m[1]! : url;
}

function PasswordSheet({ profile, saved, onChanged }: { profile: string; saved: SavedPassword; onChanged: () => void }) {
  const theme = useTheme();
  const [username, setUsername] = useState(saved.username);
  const [password, setPassword] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState(false);
  useEffect(() => void getPassword(profile, saved.origin, saved.username).then(setPassword), []);

  const save = async () => {
    await updatePassword(profile, saved.origin, saved.username, {
      username: username !== saved.username ? username : undefined,
      password: password ?? undefined,
    });
    onChanged();
    closeSettingsSheet();
  };
  const remove = async () => {
    const { confirmed } = await confirm({
      title: `删除 ${hostLabel(saved.origin)} 的密码？`,
      message: "您将无法再使用此密码自动登录。",
      confirmTitle: "删除",
      destructive: true,
    });
    if (!confirmed) return;
    await deletePassword(profile, saved.origin, saved.username);
    onChanged();
    closeSettingsSheet();
  };

  return (
    <Sheet width={440} onClose={closeSettingsSheet}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Favicon url={saved.origin} size={22} />
        <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: theme.textPrimary }}>{hostLabel(saved.origin)}</Text>
      </View>
      <View style={{ marginTop: 14 }}>
        <Group>
          <Row title="网站" description={saved.origin} />
          <Row title="用户名">
            {editing ? (
              <TextField value={username} onChangeText={setUsername} style={{ width: 220 }} />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text selectable style={{ fontSize: 13, color: theme.textPrimary }}>
                  {saved.username}
                </Text>
                <IconButton icon="doc.on.doc" size={11} box={24} radius={6} onPress={() => copyText(saved.username)} tooltip="复制用户名" />
              </View>
            )}
          </Row>
          <Row title="密码">
            {editing ? (
              <TextField value={password ?? ""} onChangeText={setPassword} secure={!revealed} style={{ width: 220 }} />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text selectable style={{ fontSize: 13, color: theme.textPrimary, fontFamily: revealed ? "Menlo" : undefined }}>
                  {password === null ? "…" : revealed ? password : "•".repeat(Math.min(password.length, 12))}
                </Text>
                <IconButton icon={revealed ? "eye.slash" : "eye"} size={11} box={24} radius={6} onPress={() => setRevealed(!revealed)} tooltip={revealed ? "隐藏" : "显示"} />
                <IconButton icon="doc.on.doc" size={11} box={24} radius={6} onPress={() => password && copyText(password)} tooltip="复制密码" />
              </View>
            )}
          </Row>
        </Group>
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 18 }}>
        <Button title="删除" kind="destructive" onPress={() => void remove()} />
        <View style={{ flex: 1 }} />
        {editing ? (
          <>
            <Button title="取消" onPress={() => setEditing(false)} />
            <Button title="保存" kind="primary" disabled={!password} onPress={() => void save()} />
          </>
        ) : (
          <>
            <Button title="编辑" onPress={() => setEditing(true)} />
            <Button title="完成" kind="primary" onPress={closeSettingsSheet} />
          </>
        )}
      </View>
    </Sheet>
  );
}
