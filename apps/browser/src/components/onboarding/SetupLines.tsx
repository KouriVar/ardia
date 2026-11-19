import { Image, View } from "react-native";
import { Checkbox, Text } from "../ui";
import { lineHeight, proseLineHeight, radius, space } from "../ui/tokens";
import { ChoiceCard } from "./ChoiceCard";
import { useOnboardingColors } from "./Parts";
import { onboardingType } from "./tokens";
import { useTranslate } from "../ui/Translate";

const ICON = require("../../../assets/app-icon.png");

const CARD_WIDTH = 260;

export function SetupLines({ heading, lines }: { heading: string; lines: string[] }) {
  const colors = useOnboardingColors();
  const t = useTranslate();
  return (
    <View style={{ alignItems: "center", gap: space.xxxl }}>
      <Image source={ICON} style={{ width: 72, height: 72 }} />
      <ChoiceCard plain radius={radius.sheet} fill={colors.card} style={{ width: CARD_WIDTH, padding: space.xl, gap: space.m }}>
        <Text size="caption" color={colors.subtitle} style={{ lineHeight: lineHeight.caption }}>
          {t(heading)}
        </Text>
        {lines.map((line) => (
          <View key={line} style={{ flexDirection: "row", gap: space.m, alignItems: "flex-start" }}>
            <Checkbox look="ring" size="s" value />
            <Text color={colors.title} style={[onboardingType.bodyCompact, { flex: 1, lineHeight: proseLineHeight.small }]}>
              {t(line)}
            </Text>
          </View>
        ))}
      </ChoiceCard>
    </View>
  );
}
