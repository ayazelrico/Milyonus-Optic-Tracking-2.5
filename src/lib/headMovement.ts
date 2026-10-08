import type { HeadPose } from "@/lib/facePose";

export type HeadMovementLevel = "low" | "medium" | "high";

export interface HeadMovementFrame {
  intensity: number | null;
  level: HeadMovementLevel | null;
  angularSpeedDegPerSec: number | null;
}

interface PoseSample {
  pose: HeadPose;
  at: number;
}

const MAX_SPEED_DEG_PER_SEC = 120;
const MEDIUM_INTENSITY = 0.25;
const HIGH_INTENSITY = 0.6;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Converts smoothed pose deltas into a time-normalized movement signal per track. */
export class HeadMovementTracker {
  private previous = new Map<number, PoseSample>();

  update(trackId: number, pose: HeadPose, at: number, confidenceWeight: number): HeadMovementFrame {
    const weight = Math.min(1, Math.max(0, confidenceWeight));
    if (weight === 0) return { intensity: null, level: null, angularSpeedDegPerSec: null };

    const previous = this.previous.get(trackId);
    this.previous.set(trackId, { pose: { ...pose }, at });
    if (!previous) return { intensity: 0, level: "low", angularSpeedDegPerSec: 0 };

    const elapsedMs = Math.max(1, at - previous.at);
    const delta = Math.hypot(
      pose.yaw - previous.pose.yaw,
      pose.pitch - previous.pose.pitch,
      pose.roll - previous.pose.roll,
    );
    const angularSpeedDegPerSec = (delta / elapsedMs) * 1000;
    const intensity = clamp01(angularSpeedDegPerSec / MAX_SPEED_DEG_PER_SEC);
    const level: HeadMovementLevel =
      intensity < MEDIUM_INTENSITY ? "low" : intensity < HIGH_INTENSITY ? "medium" : "high";
    return { intensity, level, angularSpeedDegPerSec };
  }

  reset() {
    this.previous.clear();
  }
}
