import { Symbol, type MenuItem } from "@ardia/shell";
import { Text, View } from "react-native";
import { profileAccent } from "../../lib/theme";
import type { Profile } from "../../store/types";

export const PROFILE_SYMBOLS: { name: string; title: string }[] = [
  { name: "house.fill", title: "家庭" },
  { name: "briefcase.fill", title: "工作" },
  { name: "graduationcap.fill", title: "学校" },
  { name: "chevron.left.forwardslash.chevron.right", title: "代码" },
  { name: "paintpalette.fill", title: "艺术" },
  { name: "hammer.fill", title: "项目" },
  { name: "book.closed.fill", title: "阅读" },
  { name: "music.note", title: "音乐" },
  { name: "camera.fill", title: "照片" },
  { name: "gamecontroller.fill", title: "游戏" },
  { name: "cart.fill", title: "购物" },
  { name: "banknote.fill", title: "财务" },
  { name: "airplane", title: "旅行" },
  { name: "figure.run", title: "健身" },
  { name: "cup.and.saucer.fill", title: "咖啡" },
  { name: "leaf.fill", title: "自然" },
  { name: "pawprint.fill", title: "宠物" },
  { name: "heart.fill", title: "个人" },
  { name: "star.fill", title: "收藏" },
  { name: "moon.stars.fill", title: "夜晚" },
];

const EMOJI = ["😀", "😎", "🤓", "🧑‍💻", "💼", "🏠", "🎓", "🎨", "🎮", "🎵", "📚", "✈️", "🌱", "🔥", "⭐️", "🚀", "🐶", "🐱", "🦊", "🍀"];

const SYMBOL_PREFIX = "symbol:";
export const profileSymbol = (icon: string | null) => (icon?.startsWith(SYMBOL_PREFIX) ? icon.slice(SYMBOL_PREFIX.length) : null);

export function iconMenuItems(current: string | null): MenuItem[] {
  return [
    { id: "icon:", title: "首字母", checked: !current },
    { separator: true },
    ...PROFILE_SYMBOLS.map((s) => ({ id: `icon:${SYMBOL_PREFIX}${s.name}`, title: s.title, symbol: s.name, checked: current === SYMBOL_PREFIX + s.name })),
    { separator: true },
    {
      id: "emoji",
      title: "表情符号",
      checked: !!current && !profileSymbol(current),
      children: EMOJI.map((e) => ({ id: `icon:${e}`, title: e, checked: current === e })),
    },
  ];
}

export function ProfileBadge({ profile, size = 26 }: { profile: Pick<Profile, "name" | "color" | "icon"> & Partial<Pick<Profile, "theme">>; size?: number }) {
  const swatch = profileAccent(profile);
  const symbol = profileSymbol(profile.icon);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: swatch,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: size >= 22 ? 0.5 : 0,
        borderColor: "rgba(0,0,0,0.12)",
      }}
    >
      {symbol ? (
        <Symbol name={symbol} size={size * 0.5} weight="semibold" color="#FFFFFF" style={{ width: size, height: size }} />
      ) : (
        <Text style={{ fontSize: profile.icon ? size * 0.55 : size * 0.46, fontWeight: "600", color: "#FFFFFF" }}>
          {profile.icon ?? (profile.name.trim()[0] ?? "?").toUpperCase()}
        </Text>
      )}
    </View>
  );
}
