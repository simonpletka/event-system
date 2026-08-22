/**
 * Colorblind-validated categorical palette for charts on the app's dark surface (#1a1918).
 * Fixed order — assign by rank/position, never cycle or reorder per-render, so adjacent
 * series stay CVD-distinguishable. Index 0 doubles as the shared "Income" chart color.
 */
export const CATEGORICAL_CHART_COLORS = [
  "#3987e5", // blue — also used for "Income" wherever that appears
  "#d95926", // orange
  "#199e70", // aqua
  "#c98500", // yellow
  "#d55181", // magenta
  "#008300", // green
  "#9085e9", // violet
  "#e66767", // red
];

export const INCOME_CHART_COLOR = CATEGORICAL_CHART_COLORS[0];

/** A series color by rank (0-indexed); beyond the 8 validated slots, falls back to a neutral gray rather than inventing a 9th hue. */
export function categoricalColor(index: number) {
  return CATEGORICAL_CHART_COLORS[index] ?? "rgba(243,242,242,0.3)";
}
