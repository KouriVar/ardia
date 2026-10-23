import { engineHost, type SearchEngine } from "@ardia/core";
import { Symbol } from "@ardia/shell";
import { useState } from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../../lib/theme";
import { useBrowser } from "../../../store/browser";
import { controllingSearchExtension, defaultSearchEngine, searchEngines } from "../../../store/settings";
import { setEnabled } from "../../extensions/state";
import { Favicon, IconButton } from "../../primitives";
import { Button, Group, Row, SectionHeader, Sheet, TextField, Toggle, useFormColors } from "../controls";
import { closeSettingsSheet, showSettingsSheet } from "../sheet";
import { openSettings } from "../windows";

export function SearchPane() {
  const settings = useBrowser((s) => s.settings);
  const colors = useFormColors();
  const engines = searchEngines(settings);
  const builtIn = engines.filter((e) => !e.custom && !e.extension);
  const custom = engines.filter((e) => e.custom);
  const fromExtensions = engines.filter((e) => e.extension);
  const selectedId = defaultSearchEngine(settings).id;
  const controlling = controllingSearchExtension(settings);
  const locked = !!controlling;

  return (
    <View>
      <SectionHeader title="默认搜索引擎" description="用于命令栏和新标签页。" />
      <Group>
        {controlling && (
          <Row
            icon={<Symbol name="puzzlepiece.extension" size={13} color={colors.accent} style={{ width: 18, height: 18 }} />}
            title={`${controlling.extensionName || "某个扩展"}正在控制此设置`}
            description="要更改默认搜索引擎，请停用此扩展或调整其设置。"
          >
            <Button title="管理" onPress={() => openSettings("extensions")} />
            <Button title="停用" onPress={() => void setEnabled(controlling.profile, controlling.extensionId, false)} />
          </Row>
        )}
        {builtIn.map((e) => (
          <EngineRow key={e.id} engine={e} selected={selectedId === e.id} locked={locked} />
        ))}
      </Group>

      <SectionHeader
        title="其他搜索引擎"
        description="在命令栏输入快捷字词后按 Tab，可直接搜索指定网站。"
        action={<Button title="添加…" icon="plus" onPress={() => showSettingsSheet(<EngineSheet />)} />}
      />
      <Group>
        {custom.length === 0 ? (
          <Row title="没有自定义搜索引擎" description="添加一个网址，并使用 %s 代替搜索关键词。" />
        ) : (
          custom.map((e) => <EngineRow key={e.id} engine={e} selected={selectedId === e.id} locked={locked} editable={e.id !== "custom"} />)
        )}
      </Group>

      {fromExtensions.length > 0 && (
        <>
          <SectionHeader title="扩展" description="某些扩展可以为 Ardia 添加搜索引擎。" />
          <Group>
            {fromExtensions.map((e) => (
              <EngineRow key={e.id} engine={e} selected={selectedId === e.id} locked={locked} />
            ))}
          </Group>
        </>
      )}

      <SectionHeader title="建议" />
      <Group>
        <Row title="显示搜索建议" description="将您输入的内容发送给搜索引擎，以提供搜索建议。">
          <Toggle value={settings.searchSuggestions} onChange={(v) => useBrowser.getState().updateSettings({ searchSuggestions: v })} />
        </Row>
      </Group>
    </View>
  );
}

function EngineRow({ engine, selected, locked, editable }: { engine: SearchEngine; selected: boolean; locked: boolean; editable?: boolean }) {
  const theme = useTheme();
  const colors = useFormColors();
  const description = engine.extension
    ? `${engine.keyword ? `${engine.keyword} · ` : ""}由 ${engine.extension.name || "某个扩展"} 添加`
    : engine.custom
      ? `${engine.keyword} · ${engine.url}`
      : engine.keyword;
  return (
    <Row icon={<Favicon url={`https://${engineHost(engine)}`} />} title={engine.name} description={description}>
      {editable && (
        <IconButton icon="pencil" size={11} box={24} radius={6} onPress={() => showSettingsSheet(<EngineSheet engine={engine} />)} tooltip="编辑" />
      )}
      {selected ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, minWidth: 92, justifyContent: "flex-end" }}>
          <Symbol name="checkmark" size={11} weight="semibold" color={colors.accent} style={{ width: 14, height: 14 }} />
          <Text style={{ fontSize: 12, color: theme.textSecondary }}>默认</Text>
        </View>
      ) : (
        <Button title="设为默认" disabled={locked} onPress={() => useBrowser.getState().setSearchEngine(engine.id)} style={{ minWidth: 92 }} />
      )}
    </Row>
  );
}

function EngineSheet({ engine }: { engine?: SearchEngine }) {
  const theme = useTheme();
  const [name, setName] = useState(engine?.name ?? "");
  const [keyword, setKeyword] = useState(engine?.keyword ?? "");
  const [url, setUrl] = useState(engine?.url ?? "");
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    const s = useBrowser.getState();
    const input = { name, keyword, url };
    let result: string | null;
    if (engine) result = s.updateCustomEngine(engine.id, input);
    else {
      const added = s.addCustomEngine(input);
      result = "error" in added ? added.error : null;
    }
    if (result) return setError(result);
    closeSettingsSheet();
  };
  const field = (label: string, value: string, set: (v: string) => void, placeholder: string) => (
    <View style={{ marginTop: 12 }}>
      <Text style={{ fontSize: 11.5, marginBottom: 5, color: theme.textSecondary }}>{label}</Text>
      <TextField value={value} onChangeText={set} placeholder={placeholder} onSubmit={save} onEscape={closeSettingsSheet} />
    </View>
  );
  return (
    <Sheet width={440} onClose={closeSettingsSheet}>
      <Text style={{ fontSize: 15, fontWeight: "600", color: theme.textPrimary }}>{engine ? "编辑搜索引擎" : "添加搜索引擎"}</Text>
      {field("名称", name, setName, "Wikipedia")}
      {field("快捷字词", keyword, setKeyword, "w")}
      {field("搜索网址（使用 %s 代替关键词）", url, setUrl, "https://en.wikipedia.org/w/index.php?search=%s")}
      {error && <Text style={{ fontSize: 12, marginTop: 10, color: "#FF453A" }}>{error}</Text>}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 18 }}>
        {engine && (
          <Button
            title="删除"
            kind="destructive"
            onPress={() => {
              useBrowser.getState().removeCustomEngine(engine.id);
              closeSettingsSheet();
            }}
          />
        )}
        <View style={{ flex: 1 }} />
        <Button title="取消" onPress={closeSettingsSheet} />
        <Button title={engine ? "保存" : "添加"} kind="primary" onPress={save} />
      </View>
    </Sheet>
  );
}
