import type { Category } from "@mediapipe/tasks-vision";

export type Emotion =
  "smile" | "sad" | "angry" | "surprised" | "fearful" | "disgusted" | "neutral" | "thinking";

export const EMOTIONS: Emotion[] = [
  "smile",
  "sad",
  "angry",
  "surprised",
  "fearful",
  "disgusted",
  "thinking",
  "neutral",
];

export type Scores = Record<Emotion, number>;

export const emptyScores = (): Scores =>
  EMOTIONS.reduce((acc, e) => ({ ...acc, [e]: 0 }), {} as Scores);

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Derives an 8-bucket "vibe" reading from MediaPipe's 52 ARKit-style
 * blendshape coefficients. This is a heuristic combination (MediaPipe itself
 * only outputs the raw shape coefficients, not discrete emotions) tuned to
 * behave like the previous face-api.js expression classifier, but driven by
 * a much richer signal. `tiltDeg` is the live head-roll angle from the 3D
 * pose so "thinking" reacts to an actual tilt instead of a guess.
 */
export function scoresFromBlendshapes(categories: Category[], tiltDeg: number): Scores {
  const map = new Map(categories.map((c) => [c.categoryName, c.score]));
  const get = (name: string) => map.get(name) ?? 0;
  const avg = (a: string, b: string) => (get(a) + get(b)) / 2;

  const smile = avg("mouthSmileLeft", "mouthSmileRight");
  const browDown = avg("browDownLeft", "browDownRight");
  const browInnerUp = get("browInnerUp");
  const jawOpen = get("jawOpen");
  const eyeWide = avg("eyeWideLeft", "eyeWideRight");
  const eyeSquint = avg("eyeSquintLeft", "eyeSquintRight");
  const mouthFrown = avg("mouthFrownLeft", "mouthFrownRight");
  const mouthPress = avg("mouthPressLeft", "mouthPressRight");
  const mouthPucker = get("mouthPucker");
  const mouthStretch = avg("mouthStretchLeft", "mouthStretchRight");
  const mouthUpperUp = avg("mouthUpperUpLeft", "mouthUpperUpRight");
  const noseSneer = avg("noseSneerLeft", "noseSneerRight");
  const cheekSquint = avg("cheekSquintLeft", "cheekSquintRight");
  const neutralRaw = get("_neutral");

  const tilt = clamp01(Math.abs(tiltDeg) / 20);

  const smileScore = clamp01(smile - browDown * 0.25);
  const sadScore = clamp01(mouthFrown * 0.7 + browInnerUp * 0.35 - smile * 0.6);
  const angryScore = clamp01(browDown * 0.6 + mouthPress * 0.3 + noseSneer * 0.2 - smile * 0.4);
  const surprisedScore = clamp01(browInnerUp * 0.35 + eyeWide * 0.4 + jawOpen * 0.4 - smile * 0.3);
  const fearfulScore = clamp01(
    eyeWide * 0.4 + mouthStretch * 0.4 + browInnerUp * 0.25 - smile * 0.3,
  );
  const disgustedScore = clamp01(noseSneer * 0.55 + mouthUpperUp * 0.25 + cheekSquint * 0.2);
  const thinkingScore = clamp01((tilt * 0.7 + mouthPucker * 0.4 + eyeSquint * 0.2) * (1 - smile));

  const excitement =
    smileScore +
    sadScore +
    angryScore +
    surprisedScore +
    fearfulScore +
    disgustedScore +
    thinkingScore;
  const neutralScore = clamp01(Math.max(neutralRaw, 1 - excitement) - excitement * 0.15);

  return {
    smile: smileScore,
    sad: sadScore,
    angry: angryScore,
    surprised: surprisedScore,
    fearful: fearfulScore,
    disgusted: disgustedScore,
    thinking: thinkingScore,
    neutral: neutralScore,
  };
}

export function dominantEmotion(scores: Scores): Emotion {
  return EMOTIONS.reduce((a, b) => (scores[b] > scores[a] ? b : a), "neutral" as Emotion);
}
