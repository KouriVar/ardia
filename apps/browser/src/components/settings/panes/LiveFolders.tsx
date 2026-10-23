import { copyText, focusWindow } from "@ardia/shell";
import { useEffect, useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import { useShallow } from "zustand/react/shallow";
import { useTheme } from "../../../lib/theme";
import { deleteLiveFolder, refreshFolder, statusText } from "../../../live/engine";
import { connectGoogleDrive } from "../../../live/googleAuth";
import { isMocked } from "../../../live/net";
import { connectBitbucket, connectConfluence, connectGithub, connectNotion, disconnect, SOURCES, startGithubDeviceFlow, type DeviceFlow } from "../../../live/sources";
import { live, updateConfig, useLive } from "../../../live/store";
import type { LiveAccount, LiveSourceId } from "../../../live/types";
import { useBrowser } from "../../../store/browser";
import { Favicon } from "../../primitives";
import { Button, Group, Row, SectionHeader, Sheet, TextField } from "../controls";
import { closeSettingsSheet, showSettingsSheet } from "../sheet";

const DESCRIPTIONS: Record<LiveSourceId, string> = {
  github: "您待处理的拉取请求及等待您审查的请求，包含检查和冲突状态。",
  bitbucket: "您在 Bitbucket Cloud 上待处理的拉取请求，包含构建状态。",
  notion: "工作区内最近编辑的页面。",
  confluence: "您创建、编辑或关注的页面。",
  gdrive: "您的云端硬盘中最近修改的文档。",
};

export function LiveFoldersPane() {
  const folders = useLive(useShallow((s) => s.folderOrder.map((id) => s.folders[id]!).filter(Boolean)));
  const profiles = useBrowser((s) => s.profiles);
  useLive((s) => s.status);
  return (
    <View>
      <SectionHeader
        title="动态文件夹"
        description="右键点击侧栏空白处，选择“新建动态文件夹”即可添加。动态文件夹每隔几分钟刷新；项目会作为标签页打开并保留在文件夹中。"
      />
      {folders.length ? (
        <Group>
          {folders.map((f) => (
            <Row key={f.id} title={f.name} description={`${profiles[f.profileId]?.name ?? "个人资料"} · ${f.sources.map((s) => SOURCES[s].name).join(", ")} · ${statusText(f.id)}`}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Button title="刷新" onPress={() => void refreshFolder(f.id)} />
                <Button title="删除" kind="destructive" onPress={() => deleteLiveFolder(f.id)} />
              </View>
            </Row>
          ))}
        </Group>
      ) : null}

      <SectionHeader title="拉取请求" />
      <Group>
        <SourceRow id="github" />
        <SourceRow id="bitbucket" />
      </Group>

      <SectionHeader title="文档" />
      <Group>
        <SourceRow id="notion" />
        <SourceRow id="confluence" />
        <SourceRow id="gdrive" />
      </Group>
      {isMocked ? <Text style={{ marginTop: 10, fontSize: 11, color: "#D29922" }}>开发构建：服务由 ARDIA_LIVE_MOCK 提供。</Text> : null}
    </View>
  );
}

function connectedAs(id: LiveSourceId, account: LiveAccount): string {
  if (!account.name || account.name === account.login) return account.login;
  return id === "github" || id === "gdrive" ? `${account.name} (${account.login})` : account.name;
}

function SourceRow({ id }: { id: LiveSourceId }) {
  const account = useLive((s) => s.accounts[id]);
  const source = SOURCES[id];
  return (
    <Row
      icon={<Favicon url={source.site} size={18} />}
      title={source.name}
      description={account ? `已连接：${connectedAs(id, account)}` : DESCRIPTIONS[id]}
    >
      {account ? (
        <Button title="断开连接" onPress={() => void disconnect(id)} />
      ) : (
        <Button title="连接…" onPress={() => showSettingsSheet(<ConnectSheet id={id} />)} />
      )}
    </Row>
  );
}

function browserWindow(): string | null {
  const s = useBrowser.getState();
  return s.ui.focusOrder.find((id) => s.windows[id] && !s.windows[id]!.incognito) ?? s.windowOrder.find((id) => !s.windows[id]!.incognito) ?? null;
}

function openInBrowser(url: string) {
  const windowId = browserWindow();
  if (!windowId) return;
  useBrowser.getState().newTab(windowId, { url });
  void focusWindow(windowId);
}

function ConnectSheet({ id }: { id: LiveSourceId }) {
  const theme = useTheme();
  const source = SOURCES[id];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
      closeSettingsSheet();
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };
  let body: ReactNode;
  switch (id) {
    case "github":
      body = <GithubConnect busy={busy} run={run} />;
      break;
    case "bitbucket":
      body = <BitbucketConnect busy={busy} run={run} />;
      break;
    case "notion":
      body = <NotionConnect busy={busy} run={run} />;
      break;
    case "confluence":
      body = <ConfluenceConnect busy={busy} run={run} />;
      break;
    case "gdrive":
      body = <GoogleConnect busy={busy} run={run} />;
      break;
  }
  return (
    <Sheet width={460} onClose={closeSettingsSheet}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <Favicon url={source.site} size={22} />
        <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: theme.textPrimary }}>Connect {source.name}</Text>
      </View>
      {body}
      {error ? <Text style={{ marginTop: 10, fontSize: 12, color: "#E5534B" }}>{error}</Text> : null}
    </Sheet>
  );
}

type ConnectProps = { busy: boolean; run(task: () => Promise<void>): Promise<void> };

function Help({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={{ fontSize: 12, lineHeight: 17, color: theme.textSecondary, marginBottom: 10 }}>{children}</Text>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 4, marginBottom: 10 }}>
      <Text style={{ fontSize: 12, fontWeight: "500", color: theme.textPrimary }}>{label}</Text>
      {children}
    </View>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>{children}</View>;
}

function GithubConnect({ busy, run }: ConnectProps) {
  const theme = useTheme();
  const [token, setToken] = useState("");
  const [clientId, setClientId] = useState(live().config.githubClientId);
  const [flow, setFlow] = useState<DeviceFlow | null>(null);
  useEffect(() => () => flow?.cancel(), [flow]);

  const signIn = () =>
    run(async () => {
      updateConfig({ githubClientId: clientId.trim() });
      const f = await startGithubDeviceFlow(clientId.trim());
      setFlow(f);
      copyText(f.userCode);
      openInBrowser(f.verificationUri);
      await f.done;
    });

  if (flow) {
    return (
      <View>
        <Help>在 GitHub 上输入此代码（已复制到剪贴板），然后授权 Ardia。登录后此面板会自动关闭。</Help>
        <Text selectable style={{ fontSize: 26, fontWeight: "600", letterSpacing: 3, fontFamily: "Menlo", color: theme.textPrimary, textAlign: "center", marginVertical: 8 }}>
          {flow.userCode}
        </Text>
        <Actions>
          <Button title="取消" onPress={() => (flow.cancel(), setFlow(null))} />
          <Button title="打开 GitHub" kind="primary" onPress={() => openInBrowser(flow.verificationUri)} />
        </Actions>
      </View>
    );
  }
  return (
    <View>
      <Help>
        粘贴个人访问令牌（经典令牌需包含“repo”和“read:org”范围；细粒度令牌需具有拉取请求、检查和元数据的读取权限）。
      </Help>
      <Field label="个人访问令牌">
        <TextField value={token} onChangeText={setToken} placeholder="ghp_…" secure onSubmit={() => token && void run(() => connectGithub(token))} />
      </Field>
      <Actions>
        <Button title="取消" onPress={closeSettingsSheet} />
        <Button title={busy ? "正在检查…" : "连接"} kind="primary" disabled={!token.trim() || busy} onPress={() => void run(() => connectGithub(token))} />
      </Actions>
      <View style={{ height: 1, backgroundColor: theme.divider, marginVertical: 14 }} />
      <Help>也可使用您自己的 GitHub OAuth 应用登录（Settings › Developer settings › OAuth Apps，并启用 Device Flow）。</Help>
      <Field label="OAuth 应用客户端 ID">
        <TextField value={clientId} onChangeText={setClientId} placeholder="Iv1.…" />
      </Field>
      <Actions>
        <Button title="使用 GitHub 登录…" disabled={!clientId.trim() || busy} onPress={() => void signIn()} />
      </Actions>
    </View>
  );
}

function BitbucketConnect({ busy, run }: ConnectProps) {
  const [user, setUser] = useState(live().config.bitbucketUser);
  const [token, setToken] = useState("");
  const go = () => void run(() => connectBitbucket(user, token));
  return (
    <View>
      <Help>创建 API 令牌（bitbucket.org › Personal settings › API tokens，授予拉取请求和仓库的读取权限），并输入 Atlassian 账户邮箱。Bitbucket 无法跨仓库搜索审查请求，因此文件夹只列出您自己的拉取请求。</Help>
      <Field label="邮箱或用户名">
        <TextField value={user} onChangeText={setUser} placeholder="you@example.com" />
      </Field>
      <Field label="API 令牌">
        <TextField value={token} onChangeText={setToken} secure onSubmit={go} />
      </Field>
      <Actions>
        <Button title="取消" onPress={closeSettingsSheet} />
        <Button title={busy ? "正在检查…" : "连接"} kind="primary" disabled={!user.trim() || !token.trim() || busy} onPress={go} />
      </Actions>
    </View>
  );
}

function NotionConnect({ busy, run }: ConnectProps) {
  const [token, setToken] = useState("");
  const go = () => void run(() => connectNotion(token));
  return (
    <View>
      <Help>在 notion.so/my-integrations 创建内部集成（读取内容；读取用户信息以获取编辑者姓名），复制密钥，并将所需页面或团队空间共享给它（••• › 连接）。</Help>
      <Field label="内部集成密钥">
        <TextField value={token} onChangeText={setToken} placeholder="ntn_…" secure onSubmit={go} />
      </Field>
      <Actions>
        <Button title="取消" onPress={closeSettingsSheet} />
        <Button title={busy ? "正在检查…" : "连接"} kind="primary" disabled={!token.trim() || busy} onPress={go} />
      </Actions>
    </View>
  );
}

function ConfluenceConnect({ busy, run }: ConnectProps) {
  const config = live().config;
  const [site, setSite] = useState(config.confluenceSite);
  const [email, setEmail] = useState(config.confluenceEmail);
  const [token, setToken] = useState("");
  const go = () => void run(() => connectConfluence(site, email, token));
  return (
    <View>
      <Help>在 id.atlassian.com › Security › API tokens 创建 API 令牌，然后输入 Confluence Cloud 网站和账户邮箱。</Help>
      <Field label="网站">
        <TextField value={site} onChangeText={setSite} placeholder="https://your-team.atlassian.net" />
      </Field>
      <Field label="邮箱">
        <TextField value={email} onChangeText={setEmail} placeholder="you@example.com" />
      </Field>
      <Field label="API 令牌">
        <TextField value={token} onChangeText={setToken} secure onSubmit={go} />
      </Field>
      <Actions>
        <Button title="取消" onPress={closeSettingsSheet} />
        <Button title={busy ? "正在检查…" : "连接"} kind="primary" disabled={!site.trim() || !email.trim() || !token.trim() || busy} onPress={go} />
      </Actions>
    </View>
  );
}

function GoogleConnect({ busy, run }: ConnectProps) {
  const [clientId, setClientId] = useState(live().config.googleClientId);
  const [secret, setSecret] = useState("");
  const go = () =>
    void run(async () => {
      const windowId = browserWindow();
      if (!windowId) throw new Error("请先打开浏览器窗口");
      void focusWindow(windowId);
      await connectGoogleDrive(windowId, clientId, secret);
    });
  return (
    <View>
      <Help>
        In Google Cloud Console, enable the Drive API and create an OAuth client of type "桌面应用" (add yourself as a test user). Ardia opens Google's consent page in a tab and reads the result from its redirect; it asks only to see your files' names and dates.
      </Help>
      <Field label="客户端 ID">
        <TextField value={clientId} onChangeText={setClientId} placeholder="…apps.googleusercontent.com" />
      </Field>
      <Field label="客户端密钥">
        <TextField value={secret} onChangeText={setSecret} secure />
      </Field>
      <Actions>
        <Button title="取消" onPress={closeSettingsSheet} />
        <Button title={busy ? "正在等待 Google…" : "使用 Google 登录…"} kind="primary" disabled={!clientId.trim() || !secret.trim() || busy} onPress={go} />
      </Actions>
    </View>
  );
}
