import type { FocusEpisodeFrame } from "@/lib/focusEpisodes";

export type FocusQualityBand = "poor" | "fair" | "good";

export interface FocusQualityFrame {
  score: number;
  band: FocusQualityBand;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Combines pose focus, detector evidence, and committed-center continuity into one quality signal. */
export function focusQualityFromSignals(
  focusScore: number,
  confidenceWeight: number,
  episode: FocusEpisodeFrame,
): FocusQualityFrame {
  const continuity = episode.active ? 1 : 0;
  const score = clamp01(focusScore) * clamp01(confidenceWeight) * continuity;
  const band: FocusQualityBand = score >= 0.75 ? "good" : score >= 0.45 ? "fair" : "poor";
  return { score, band };
}
