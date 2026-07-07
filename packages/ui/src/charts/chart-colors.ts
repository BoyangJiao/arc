/** Append Skia-compatible alpha to #RRGGBB hex colors. */
export const colorWithOpacity = (color: string, opacity: number): string => {
  if (color.startsWith("#") && color.length === 7) {
    const alpha = Math.round(Math.min(1, Math.max(0, opacity)) * 255)
      .toString(16)
      .padStart(2, "0");
    return `${color}${alpha}`;
  }
  return color;
};
