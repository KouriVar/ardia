import { showMenu, Symbol } from "@ardia/shell";
import { SyncNative, type FolderInfo } from "@ardia/sync";
import { useEffect, useState, type ReactNode } from "react";
import { Image, StyleSheet, Text, TextInput, View } from "react-native";
import { useTheme } from "../../../lib/theme";
import { enterRecoveryPhrase, stopSync } from "../../../sync/engine";
import { Button, Checkbox, Sheet, useFormColors } from "../controls";
import { closeSettingsSheet, showSettingsSheet } from "../sheet";

const WORDS = 24;

function Title({ children }: { children: string }) {
  const theme = useTheme();
  return <Text style={{ fontSize: 15, fontWeight: "600", color: theme.textPrimary }}>{children}</Text>;
}

function Body({ children, style }: { children: ReactNode; style?: object }) {
  const theme = useTheme();
  return <Text style={[{ fontSize: 12.5, lineHeight: 17, marginTop: 6, color: theme.textSecondary }, style]}>{children}</Text>;
}

function Buttons({ children, left }: { children: ReactNode; left?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18 }}>
      {left}
      <View style={{ flex: 1 }} />
      {children}
    </View>
  );
}

export function showRecoveryKit() {
  showSettingsSheet(<RecoveryKitSheet />);
}

function RecoveryKitSheet() {
  const theme = useTheme();
  const colors = useFormColors();
  const [preview, setPreview] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => void SyncNative?.recoveryKitPreview(168).then(setPreview), []);
  const save = async (format: "pdf" | "text") => {
    const path = await SyncNative?.saveRecoveryKit(format);
    if (path) setSaved(path);
  };
  const more = async () => {
    const choice = await showMenu([
      { id: "copy", title: "复制", symbol: "doc.on.doc" },
      { id: "share", title: "共享…", symbol: "square.and.arrow.up" },
      { separator: true },
      { id: "text", title: "存储为文本…", symbol: "doc.plaintext" },
    ]);
    if (choice === "copy") await SyncNative?.copyRecoveryKit();
    else if (choice === "share") await SyncNative?.shareRecoveryKit();
    else if (choice === "text") await save("text");
  };
  return (
    <Sheet width={460} onClose={closeSettingsSheet}>
      <View style={{ flexDirection: "row", gap: 18 }}>
        <View style={{ flex: 1 }}>
          <Title>保存您的恢复套件</Title>
          <Body>如果无法再使用此设备，恢复套件中包含恢复数据所需的全部信息。</Body>
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginTop: 14,
              padding: 10,
              borderRadius: 8,
              backgroundColor: theme.dark ? "rgba(255,159,10,0.12)" : "rgba(255,149,0,0.1)",
            }}
          >
            <Symbol name="exclamationmark.triangle.fill" size={12} color="#FF9500" style={{ width: 16, height: 16 }} />
            <Text style={{ flex: 1, fontSize: 12, lineHeight: 16, color: theme.textPrimary }}>
              请将恢复套件的副本保存到
              <Text style={{ textDecorationLine: "underline" }}>另一台</Text>设备或云端。如果无法再使用此设备，您将需要此副本。
            </Text>
          </View>
          {saved ? <Body style={{ marginTop: 10 }}>已保存到 {saved.replace(/^\/Users\/[^/]+/, "~")}.</Body> : null}
        </View>
        <View
          accessibilityLabel="恢复套件预览"
          style={{ width: 168, height: 217, borderRadius: 4, overflow: "hidden", borderWidth: 1, borderColor: colors.groupBorder, backgroundColor: "#FFFFFF" }}
        >
          {preview ? <Image source={{ uri: preview }} style={{ width: 168, height: 217 }} /> : null}
        </View>
      </View>
      <Buttons left={<Button title="其他选项" onPress={() => void more()} />}>
        <Button title="关闭" onPress={closeSettingsSheet} />
        <Button title="保存…" kind="primary" onPress={() => void save("pdf")} />
      </Buttons>
    </Sheet>
  );
}

export function showPhraseEntry(folder: FolderInfo | null, onChooseFolder?: () => void) {
  showSettingsSheet(<PhraseSheet folder={folder} onChooseFolder={onChooseFolder} />);
}

const phraseError = (r: Awaited<ReturnType<typeof enterRecoveryPhrase>>): string | null => {
  if ("ok" in r) return null;
  switch (r.error) {
    case "wordCount":
      return "恢复短语必须恰好包含 24 个单词。";
    case "unknownWord":
      return `“${r.word}”不是有效的恢复短语单词。`;
    case "checksum":
      return "此恢复短语无效。请检查是否有拼写错误。";
    case "mismatch":
      return "此恢复短语与文件夹中的同步数据不匹配。请检查短语，或选择其他设备使用的同步文件夹。";
    case "noData":
      return "此文件夹尚无同步数据。请选择其他设备使用的同步文件夹，或等待数据下载完成。";
    case "keychain":
      return "无法将同步密钥保存到钥匙串。";
    case "unavailable":
      return "此构建版本不支持同步。";
  }
};

function PhraseSheet({ folder, onChooseFolder }: { folder: FolderInfo | null; onChooseFolder?: () => void }) {
  const theme = useTheme();
  const colors = useFormColors();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = text.toLowerCase().split(/[^a-z]+/).filter(Boolean).length;
  const submit = async () => {
    if (!folder || busy) return;
    setBusy(true);
    setError(null);
    const result = await enterRecoveryPhrase(folder.path, text);
    setBusy(false);
    const message = phraseError(result);
    if (message) setError(message);
    else closeSettingsSheet();
  };
  return (
    <Sheet width={440} onClose={closeSettingsSheet}>
      <Title>使用恢复短语连接</Title>
      <Body>输入您的 24 个单词恢复短语，以与另一台设备同步。</Body>
      <View
        style={{
          marginTop: 12,
          height: 96,
          borderRadius: 7,
          padding: 8,
          backgroundColor: colors.field,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: error ? colors.destructive : colors.fieldBorder,
        }}
      >
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            setError(null);
          }}
          multiline
          autoFocus
          placeholder="输入您的 24 个单词恢复短语"
          placeholderTextColor={theme.textTertiary}
          selectionColor={theme.selection}
          enableFocusRing={false}
          autoCorrect={false}
          spellCheck={false}
          style={{ flex: 1, fontSize: 13, lineHeight: 18, color: theme.textPrimary, fontFamily: "Menlo" }}
        />
      </View>
      <View style={{ flexDirection: "row", marginTop: 6 }}>
        <Text style={{ flex: 1, fontSize: 11.5, lineHeight: 15, color: error ? colors.destructive : theme.textSecondary }}>{error ?? ""}</Text>
        <Text style={{ fontSize: 11.5, color: count > WORDS ? colors.destructive : theme.textTertiary, fontVariant: ["tabular-nums"] }}>
          {count > WORDS ? "单词过多" : `${count}/${WORDS} 个单词`}
        </Text>
      </View>
      {folder ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
          <Symbol name="folder" size={11} color={theme.textSecondary} style={{ width: 14, height: 14 }} />
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 11.5, color: theme.textSecondary }}>
            {folderLabel(folder)}
          </Text>
          {onChooseFolder ? <Button title="更改…" kind="plain" onPress={onChooseFolder} /> : null}
        </View>
      ) : null}
      <Buttons>
        <Button title="取消" onPress={closeSettingsSheet} />
        <Button title={busy ? "正在连接…" : "连接"} kind="primary" disabled={busy || count !== WORDS || !folder} onPress={() => void submit()} />
      </Buttons>
    </Sheet>
  );
}

export function showConnectDevice() {
  showSettingsSheet(<ConnectDeviceSheet />);
}

function ConnectDeviceSheet() {
  const theme = useTheme();
  const colors = useFormColors();
  const [qr, setQr] = useState<string | null>(null);
  const [words, setWords] = useState<string[] | null>(null);
  useEffect(() => void SyncNative?.qrCode().then(setQr), []);
  return (
    <Sheet width={480} onClose={closeSettingsSheet}>
      <Title>连接另一台设备</Title>
      <Body>
        在另一台 Mac 上，打开“Ardia › 设置 › 同步”并选择同一同步文件夹。然后点击“输入恢复短语”，输入恢复短语中的 24 个单词。
      </Body>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 16 }}>
        <View style={{ width: 132, height: 132, borderRadius: 8, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
          {qr ? <Image source={{ uri: qr }} style={{ width: 120, height: 120 }} /> : null}
        </View>
        <Text style={{ flex: 1, fontSize: 12, lineHeight: 16, color: theme.textSecondary }}>
          也可使用 iPhone 相机扫描此二维码来复制单词，然后通过通用剪贴板粘贴到另一台 Mac 上。
        </Text>
      </View>
      {words ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 14, padding: 10, borderRadius: 8, backgroundColor: colors.group }}>
          {words.map((w, i) => (
            <Text key={i} style={{ width: "25%", paddingVertical: 3, fontSize: 12.5, color: theme.textPrimary, fontFamily: "Menlo" }}>
              <Text style={{ color: theme.textTertiary }}>{`${i + 1}`.padStart(2, " ")} </Text>
              {w}
            </Text>
          ))}
        </View>
      ) : null}
      <Buttons
        left={
          <>
            <Button title={words ? "隐藏单词" : "显示单词"} onPress={() => (words ? setWords(null) : void SyncNative?.recoveryWords().then(setWords))} />
            <Button title="复制单词" onPress={() => void SyncNative?.copyRecoveryPhrase()} />
          </>
        }
      >
        <Button title="完成" kind="primary" onPress={closeSettingsSheet} />
      </Buttons>
    </Sheet>
  );
}

export function showStopSync() {
  showSettingsSheet(<StopSheet />);
}

function StopSheet() {
  return (
    <Sheet width={420} onClose={closeSettingsSheet}>
      <Title>停止同步此设备？</Title>
      <Body>
        此设备将停止同步。要重新开启同步，需要另一台正在同步的设备，或恢复套件中的恢复短语。此 Mac 上的所有数据保持不变。
      </Body>
      <Buttons left={<Button title="保存恢复套件" onPress={() => showSettingsSheet(<RecoveryKitSheet />)} />}>
        <Button title="取消" onPress={closeSettingsSheet} />
        <Button title="停止同步" kind="destructive" onPress={() => showSettingsSheet(<DeleteDataSheet />)} />
      </Buttons>
    </Sheet>
  );
}

function DeleteDataSheet() {
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const finish = async (deleteData: boolean) => {
    setBusy(true);
    await stopSync({ deleteData });
    closeSettingsSheet();
  };
  return (
    <Sheet width={420} onClose={() => void finish(false)}>
      <Title>删除同步数据？</Title>
      <Body>
        是否也永久删除同步文件夹中的同步数据？这也会停止所有其他设备的同步。要再次同步，需重新设置每台设备。各台 Mac 上的数据会保留。
      </Body>
      <View style={{ marginTop: 12 }}>
        <Checkbox value={understood} onChange={setUnderstood} label="我了解此操作无法撤销" />
      </View>
      <Buttons>
        <Button title="保留同步数据" disabled={busy} onPress={() => void finish(false)} />
        <Button title="删除我的同步数据" kind="destructive" disabled={!understood || busy} onPress={() => void finish(true)} />
      </Buttons>
    </Sheet>
  );
}

export function folderLabel(folder: Pick<FolderInfo, "path" | "inICloud">): string {
  if (folder.inICloud) {
    const rest = folder.path.split("com~apple~CloudDocs")[1]?.split("/").filter(Boolean) ?? [];
    return ["iCloud Drive", ...rest].join(" › ");
  }
  return folder.path.replace(/^\/Users\/[^/]+/, "~");
}
