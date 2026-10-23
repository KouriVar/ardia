import type { BookmarkNode, Bookmarks } from "../store/types";

export function bookmarkTitle(bookmarks: Bookmarks, node: BookmarkNode): string {
  for (const roots of Object.values(bookmarks.roots)) {
    if (roots.bar === node.id) return "书签栏";
    if (roots.other === node.id) return "其他书签";
  }
  return node.title;
}
