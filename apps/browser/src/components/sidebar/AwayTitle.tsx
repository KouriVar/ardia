import { memo } from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { AwayTitle } from "../../state/pins/organize";
import { FadeLabel } from "../ui";
import { withAlpha } from "../ui/tokens";
import { AWAY_TITLE } from "./tokens";
import { useTranslate } from "../ui/Translate";

export const AwayTitleLabel = memo(function AwayTitleLabel({
  away,
  color,
  fontSize,
  weight,
  height,
  style,
}: {
  away: AwayTitle;
  color: string;
  fontSize: number;
  weight?: "medium" | "regular";
  height: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTranslate();
  const fontWeight = weight === "medium" ? "500" : undefined;
  return (
    <View accessible accessibilityLabel={away.pinned ? t("{pinned}, now on {page}", { pinned: away.pinned, page: away.page }) : t("Pinned tab, now on {page}", { page: away.page })} style={[{ flexDirection: "row", alignItems: "center", height }, style]}>
      {away.pinned ? (
        <Text numberOfLines={1} style={{ fontSize, fontWeight, color, flexShrink: 1, maxWidth: AWAY_TITLE.pinnedMaxWidth }}>
          {away.pinned}
        </Text>
      ) : null}
      <Text style={{ fontSize, fontWeight, color: withAlpha(color, AWAY_TITLE.slashAlpha), marginLeft: away.pinned ? AWAY_TITLE.slashGap : 0, marginRight: AWAY_TITLE.slashGap }}>/</Text>
      <FadeLabel text={away.page} fontSize={fontSize} weight={weight} color={color} style={{ flex: 1, height }} />
    </View>
  );
});
