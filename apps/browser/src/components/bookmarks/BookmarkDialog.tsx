import { prompt, Surface } from "@ardia/shell";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { hex, layout, useTheme } from "../../lib/theme";
import { useBrowser } from "../../store/browser";
import { useWindowId } from "../../store/hooks";
import { Button, TextField, useFormColors } from "../settings/controls";
import { useBookmarkDialog, type BookmarkDialogState } from "./actions";
import { FolderTree } from "./FolderTree";
import { SIDEBAR_HEADER_WITH_FIELD, useAddressBarInSidebar } from "../layout/windowLayout";

export function BookmarkDialog() {
  const windowId = useWindowId();
  const open = useBookmarkDialog((d) => (d.open?.windowId === windowId ? d.open : null));
  if (!open) return null;
  return <DialogPanel key={open.kind === "page" ? open.bookmarkId : "all"} state={open} />;
}

function DialogPanel({ state }: { state: BookmarkDialogState }) {
  const theme = useTheme();
  const colors = useFormColors();
  const addressBar = useAddressBarInSidebar();
  const bookmark = useBrowser((s) => (state.kind === "page" ? s.bookmarks.nodes[state.bookmarkId] : undefined));
  const profileId = state.kind === "page" ? profileOfNode(state.bookmarkId) : state.profileId;
  const [name, setName] = useState(() => (state.kind === "page" ? (bookmark?.title ?? "") : ""));
  const [folderId, setFolderId] = useState<string | null>(() =>
    state.kind === "page" ? (bookmark?.parentId ?? null) : (useBrowser.getState().bookmarks.roots[state.profileId]?.bar ?? null),
  );
  const close = () => useBookmarkDialog.getState().set(null);

  useEffect(() => {
    if (state.kind === "page" && !bookmark) close();
  }, [bookmark]);

  const done = () => {
    const s = useBrowser.getState();
    if (state.kind === "page") {
      if (!s.bookmarks.nodes[state.bookmarkId]) return close();
      if (name.trim() && name !== bookmark?.title) s.updateBookmark(state.bookmarkId, { title: name.trim() });
      if (folderId && folderId !== bookmark?.parentId) s.moveBookmark(state.bookmarkId, folderId);
    } else {
      const title = name.trim() || "标签页";
      s.addBookmarkTree(state.profileId, [{ title, children: state.tabs.map((t) => ({ title: t.title, url: t.url })) }], folderId ?? undefined);
    }
    close();
  };

  const remove = () => {
    if (state.kind === "page") useBrowser.getState().removeBookmark(state.bookmarkId);
    close();
  };

  const newFolder = async () => {
    const title = await prompt({ title: "新建文件夹", placeholder: "文件夹名称", confirmTitle: "创建", windowId: state.windowId });
    if (!title || !profileId) return;
    const id = useBrowser.getState().addBookmarkFolder({ profileId, title, parentId: folderId ?? undefined });
    setFolderId(id);
  };

  const heading = state.kind === "allTabs" ? `将 ${state.tabs.length} 个标签页加入书签` : "已添加书签";

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={StyleSheet.absoluteFill} onPress={done} />
      <Surface
        fill={hex(theme.panel)}
        cornerRadius={14}
        borderColor={hex(theme.panelBorder)}
        borderWidth={0.5}
        shadowColor="#000000"
        shadowOpacity={theme.panelShadowOpacity}
        shadowRadius={24}
        shadowOffset={[0, 10]}
        style={{
          position: "absolute",
          ...(addressBar ? { top: SIDEBAR_HEADER_WITH_FIELD + 4, left: layout.sidebarInset } : { top: layout.cardTop + layout.toolbarHeight - 2, right: layout.cardInset + 10 }),
          width: 320,
          padding: 14,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: "600", color: theme.textPrimary }}>{heading}</Text>
        <Text style={{ fontSize: 11.5, marginTop: 12, marginBottom: 5, color: theme.textSecondary }}>{state.kind === "allTabs" ? "文件夹名称" : "名称"}</Text>
        <TextField value={name} onChangeText={setName} autoFocus selectOnFocus placeholder={state.kind === "allTabs" ? "标签页" : "名称"} onSubmit={done} onEscape={done} />
        <Text style={{ fontSize: 11.5, marginTop: 12, marginBottom: 5, color: theme.textSecondary }}>文件夹</Text>
        <View
          style={{
            height: 176,
            borderRadius: 7,
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderColor: colors.fieldBorder,
            backgroundColor: colors.field,
            overflow: "hidden",
          }}
        >
          <ScrollView contentContainerStyle={{ padding: 4 }}>
            {profileId && <FolderTree profileId={profileId} selectedId={folderId} onSelect={setFolderId} rowHeight={24} />}
          </ScrollView>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 14, gap: 8 }}>
          <Button title="新建文件夹" onPress={newFolder} />
          <View style={{ flex: 1 }} />
          {state.kind === "page" ? <Button title="移除" onPress={remove} /> : <Button title="取消" onPress={close} />}
          <Button title={state.kind === "page" ? "完成" : "保存"} kind="primary" onPress={done} />
        </View>
      </Surface>
    </View>
  );
}

function profileOfNode(id: string): string | null {
  const b = useBrowser.getState().bookmarks;
  let node = b.nodes[id];
  for (let i = 0; node?.parentId && i < 64; i++) node = b.nodes[node.parentId];
  if (!node) return null;
  return Object.entries(b.roots).find(([, r]) => r.bar === node!.id || r.other === node!.id)?.[0] ?? null;
}
