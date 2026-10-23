import { getSiteSettings, resolveExternalApp, setSiteSetting, type AutofillPrompt as ChromeAutofillPrompt, type AutofillPromptAnswer, type PasswordPrompt as ChromePasswordPrompt, type PasswordPromptAnswer } from "@ardia/ardiacore";
import { Symbol } from "@ardia/shell";
import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useTheme } from "../../lib/theme";
import { webviews } from "../../lib/webviews";
import { useBrowser } from "../../store/browser";
import { engineProfile } from "../../store/model";
import { useHover } from "../primitives";
import { PANEL, PanelCloseButton, Popover, PopoverRow, PopoverSeparator, PromptButton } from "../layout/controls";
import { Checkbox } from "../settings/controls";
import { patchPage, pageOf, setPopover, usePage } from "../layout/pageState";
import { answerPermission, describePermission } from "./permissions";

const hostOf = (origin: string) => {
  try {
    return new URL(origin).hostname.replace(/^www\./, "") || origin;
  } catch {
    return origin;
  }
};

function PromptBody({
  icons,
  image,
  title,
  message,
  detail,
  children,
}: {
  icons: string[];
  image?: string | null;
  title: string;
  message?: string | null;
  detail?: React.ReactNode;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ padding: PANEL.inset, gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {image ? <Image source={{ uri: image }} style={{ width: 32, height: 32, marginLeft: -1, marginVertical: -1 }} /> : null}
        {icons.map((icon) => (
          <View key={icon} style={{ width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: theme.dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)" }}>
            <Symbol name={icon} size={14} color={theme.icon} style={{ width: 20, height: 20 }} />
          </View>
        ))}
      </View>
      <View style={{ gap: 3 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: theme.textPrimary }}>{title}</Text>
        {message ? <Text style={{ fontSize: 12, color: theme.textSecondary }}>{message}</Text> : null}
      </View>
      {detail}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end", marginTop: 2 }}>{children}</View>
    </View>
  );
}

export function PermissionPrompt({ tabId, left, top }: { tabId: string; left: number; top: number }) {
  const request = usePage(tabId, (p) => p.permission);
  if (!request) return null;
  const { icons, question } = describePermission(request);
  return (
    <Popover key={request.id} width={300} top={top} left={left} modal={false}>
      <View>
        <PromptBody icons={icons} title={question} message="随时点击锁图标即可更改">
          <PromptButton title="不允许" onPress={() => answerPermission(tabId, request.id, "deny")} />
          <PromptButton title="允许" primary onPress={() => answerPermission(tabId, request.id, "accept")} />
        </PromptBody>
        <PanelCloseButton onPress={() => answerPermission(tabId, request.id, "dismiss")} />
      </View>
    </Popover>
  );
}

export function BlockedPopupsPrompt({ tabId, right, left, top }: { tabId: string; right?: number; left?: number; top: number }) {
  const theme = useTheme();
  const popups = usePage(tabId, (p) => p.popups);
  if (!popups.length) return null;
  const origin = popups[0]!.origin;
  const site = hostOf(origin);
  const web = () => webviews.get(tabId);
  const close = () => setPopover(tabId, null);
  const done = () => {
    patchPage(tabId, { popups: [] });
    close();
  };
  const profile = () => engineProfile(useBrowser.getState().tabs[tabId]?.profileId ?? "");
  return (
    <Popover width={360} top={top} right={right} left={left} onDismiss={close}>
      <View style={{ paddingBottom: PANEL.listPadding }}>
        <PromptBody
          icons={["macwindow.badge.plus"]}
          title={`始终允许 ${site} 的弹出式窗口？`}
          message={`可始终允许 ${site} 打开弹出式窗口、每次询问，或始终拒绝。`}
        >
          <PromptButton
            title="始终拒绝"
            onPress={() => {
              void setSiteSetting(profile(), origin, "popups", "block");
              done();
            }}
          />
          <PromptButton
            title="仅此一次"
            onPress={() => {
              for (const p of popups) void web()?.openBlockedPopup(p.id, false);
              done();
            }}
          />
          <PromptButton
            title="始终允许"
            primary
            onPress={() => {
              for (const p of popups) void web()?.openBlockedPopup(p.id, true);
              done();
            }}
          />
        </PromptBody>
        <PopoverSeparator />
        {popups.slice(-5).map((p) => (
          <PopoverRow
            key={p.id}
            icon="arrow.up.forward.app"
            title={p.url.replace(/^https?:\/\//, "") || "about:blank"}
            onPress={() => {
              void web()?.openBlockedPopup(p.id, false);
              const rest = pageOf(tabId).popups.filter((x) => x.id !== p.id);
              patchPage(tabId, { popups: rest });
              if (!rest.length) close();
            }}
          />
        ))}
        {popups.length > 5 ? <Text style={{ fontSize: 11, color: theme.textSecondary, paddingLeft: PANEL.textColumn, paddingTop: 2 }}>{`and ${popups.length - 5} more`}</Text> : null}
      </View>
    </Popover>
  );
}

export async function shouldPromptForPopups(profile: string, origin: string): Promise<boolean> {
  try {
    const settings = await getSiteSettings(profile, origin);
    return settings.popups.isDefault;
  } catch {
    return true;
  }
}

export function showPasswordPrompt(tabId: string, prompt: ChromePasswordPrompt) {
  patchPage(tabId, { passwordPrompt: prompt.state === "saved" ? null : prompt });
}

export function PasswordPrompt({ tabId, right, top }: { tabId: string; right: number; top: number }) {
  const theme = useTheme();
  const prompt = usePage(tabId, (p) => p.passwordPrompt);
  const [chosen, setChosen] = useState<string | null>(null);
  if (!prompt) return null;
  const site = hostOf(prompt.origin);
  const update = prompt.state === "update";
  const username = chosen ?? prompt.username;
  const answer = (action: PasswordPromptAnswer) => {
    void webviews.get(tabId)?.resolvePasswordPrompt(action, action === "save" || action === "update" ? { username } : undefined);
    setChosen(null);
    patchPage(tabId, { passwordPrompt: null });
  };
  const well = theme.dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
  const choices = update && prompt.usernames.length > 1 ? prompt.usernames : [];
  return (
    <Popover key={`${prompt.origin}|${prompt.username}|${prompt.state}`} width={update ? 310 : 350} top={top} right={right} modal={false}>
      <View>
        <PromptBody
          icons={["key.fill"]}
          title={update ? "更新已保存的密码？" : `保存 ${site} 的密码？`}
          message={update ? `以后会在 ${site} 上自动填充` : "这样下次就能自动填充"}
          detail={
            choices.length ? (
              <View style={{ borderRadius: 8, paddingVertical: 3, backgroundColor: well }}>
                {choices.map((name) => (
                  <UsernameChoice key={name} name={name} selected={name === username} onPress={() => setChosen(name)} />
                ))}
              </View>
            ) : (
              <View style={{ borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, gap: 3, backgroundColor: well }}>
                <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "500", color: theme.textPrimary }}>
                  {username || (prompt.federation ? `通过 ${hostOf(prompt.federation)} 登录` : "没有用户名")}
                </Text>
                {prompt.passwordLength > 0 && (
                  <Text numberOfLines={1} style={{ fontSize: 12, letterSpacing: 1, color: theme.textSecondary }}>
                    {"•".repeat(Math.min(prompt.passwordLength, 16))}
                  </Text>
                )}
              </View>
            )
          }
        >
          {!update && <PromptButton title="此网站永不使用" onPress={() => answer("never")} />}
          <PromptButton title="暂不" onPress={() => answer(update ? "nope" : "dismiss")} />
          <PromptButton title={update ? "更新" : "保存"} primary onPress={() => answer(update ? "update" : "save")} />
        </PromptBody>
        <PanelCloseButton onPress={() => answer("dismiss")} />
      </View>
    </Popover>
  );
}

export function showAutofillPrompt(tabId: string, prompt: ChromeAutofillPrompt | null, id: number) {
  if (prompt) patchPage(tabId, { autofillPrompt: prompt });
  else if (pageOf(tabId).autofillPrompt?.id === id) patchPage(tabId, { autofillPrompt: null });
}

export function AutofillPrompt({ tabId, right, top }: { tabId: string; right: number; top: number }) {
  const theme = useTheme();
  const prompt = usePage(tabId, (p) => p.autofillPrompt);
  if (!prompt) return null;
  const answer = (action: AutofillPromptAnswer) => {
    void webviews.get(tabId)?.resolveAutofillPrompt(prompt.id, action);
    patchPage(tabId, { autofillPrompt: null });
  };
  const well = theme.dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
  const changes = prompt.changes ?? [];
  const values = (key: "to" | "from") => changes.filter((c) => c[key]).map((c) => c[key]);
  const section = (lines: string[], label?: string) => (
    <View key={label ?? "lines"} style={{ gap: 3 }}>
      {label ? <Text style={{ fontSize: 11, color: theme.textSecondary }}>{label}</Text> : null}
      {lines.map((line, i) => (
        <Text key={i} numberOfLines={2} style={{ fontSize: 12, fontWeight: i === 0 && !label ? "500" : "400", color: i === 0 || label ? theme.textPrimary : theme.textSecondary }}>
          {line}
        </Text>
      ))}
    </View>
  );
  const sections =
    prompt.kind !== "updateAddress"
      ? [section(prompt.lines)]
      : prompt.newLabel
        ? [section(values("to"), prompt.newLabel), section(values("from"), prompt.oldLabel)]
        : [section(values("to"))];
  return (
    <Popover key={prompt.id} width={350} top={top} right={right} modal={false}>
      <View>
        <PromptBody
          icons={[prompt.kind === "saveCard" ? "creditcard.fill" : "mappin.and.ellipse"]}
          title={prompt.title}
          message={prompt.message || null}
          detail={
            <>
              <View style={{ borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, gap: 8, backgroundColor: well }}>{sections}</View>
              {prompt.footer ? <Text style={{ fontSize: 11, color: theme.textSecondary }}>{prompt.footer}</Text> : null}
            </>
          }
        >
          <PromptButton title={prompt.decline} onPress={() => answer("decline")} />
          <PromptButton title={prompt.accept} primary onPress={() => answer("accept")} />
        </PromptBody>
        <PanelCloseButton onPress={() => answer("dismiss")} />
      </View>
    </Popover>
  );
}

export function ExternalAppPrompt({ tabId, left, top }: { tabId: string; left: number; top: number }) {
  const theme = useTheme();
  const request = usePage(tabId, (p) => p.externalApp);
  const [always, setAlways] = useState(false);
  if (!request) return null;
  const answer = (open: boolean) => {
    answerExternalApp(tabId, open, open && always);
    setAlways(false);
  };
  return (
    <Popover key={request.id} width={340} top={top} left={left} modal={false}>
      <View>
        <PromptBody
          icons={request.icon ? [] : [request.app ? "app" : "questionmark.app.dashed"]}
          image={request.icon}
          title={request.title}
          message={request.message}
          detail={
            request.remember ? (
              <Pressable onPress={() => setAlways(!always)} style={{ flexDirection: "row", alignItems: "flex-start", gap: 7 }}>
                <View style={{ marginTop: 1 }}>
                  <Checkbox value={always} onChange={setAlways} />
                </View>
                <Text style={{ flex: 1, fontSize: 12, lineHeight: 16, color: theme.textPrimary }}>{request.remember}</Text>
              </Pressable>
            ) : undefined
          }
        >
          {request.app ? (
            <>
              <PromptButton title="取消" onPress={() => answer(false)} />
              <PromptButton title="打开" primary onPress={() => answer(true)} />
            </>
          ) : (
            <PromptButton title="好" primary onPress={() => answer(false)} />
          )}
        </PromptBody>
        <PanelCloseButton onPress={() => answer(false)} />
      </View>
    </Popover>
  );
}

export function answerExternalApp(tabId: string, open: boolean, remember = false) {
  const request = pageOf(tabId).externalApp;
  if (!request) return;
  patchPage(tabId, { externalApp: null });
  void resolveExternalApp(request.id, open, remember);
}

function UsernameChoice({ name, selected, onPress }: { name: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  const { hovered, hoverProps } = useHover();
  return (
    <View {...hoverProps}>
      <Pressable onPress={onPress}>
        <View style={{ height: 28, marginHorizontal: 3, paddingHorizontal: 7, borderRadius: 6, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: hovered ? theme.rowHover : undefined }}>
          {selected ? (
            <Symbol name="checkmark" size={10} weight="semibold" color={theme.textPrimary} style={{ width: 14, height: 14 }} />
          ) : (
            <View style={{ width: 14, height: 14 }} />
          )}
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: theme.textPrimary }}>
            {name || "没有用户名"}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
