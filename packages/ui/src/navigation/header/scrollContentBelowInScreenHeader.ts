import type { ScrollViewProps } from "react-native";

/**
 * Pass to `<Screen contentContainerStyle={scrollContentBelowInScreenHeader} />` when the
 * first scroll child is `<InScreenHeader />`.
 *
 * `Screen` defaults to `padding: 24` on scroll content; that adds a second top gap below
 * the safe-area inset and makes the nav row look vertically "floating" with too much
 * space above it. iOS treats the 44pt bar as immediately under the status bar — no extra
 * scroll padding on top.
 */
export const scrollContentBelowInScreenHeader: NonNullable<
  ScrollViewProps["contentContainerStyle"]
> = {
  paddingHorizontal: 16,
  paddingTop: 0,
  paddingBottom: 24,
  gap: 16,
};
