import type { HeadPoseVelocityFrame } from "@/lib/headPoseVelocity";

export interface HeadPoseAccelerationFrame {
  yawAcceleration: number | null;
  pitchAcceleration: number | null;
  rollAcceleration: number | null;
}

interface VelocitySample {
  velocity: HeadPoseVelocityFrame;
  at: number;
}

/** Converts per-track angular velocity changes into degrees-per-second-squared. */
export class HeadPoseAccelerationTracker {
  private previous = new Map<number, VelocitySample>();

  update(
    trackId: number,
    velocity: HeadPoseVelocityFrame,
    at: number,
    confidenceWeight: number,
  ): HeadPoseAccelerationFrame {
    if (
      confidenceWeight <= 0 ||
      velocity.yawVelocity == null ||
      velocity.pitchVelocity == null ||
      velocity.rollVelocity == null
    ) {
      return { yawAcceleration: null, pitchAcceleration: null, rollAcceleration: null };
    }

    const previous = this.previous.get(trackId);
    this.previous.set(trackId, { velocity, at });
    if (!previous) return { yawAcceleration: 0, pitchAcceleration: 0, rollAcceleration: 0 };

    const elapsedMs = Math.max(1, at - previous.at);
    return {
      yawAcceleration:
        ((velocity.yawVelocity - (previous.velocity.yawVelocity ?? 0)) / elapsedMs) * 1000,
      pitchAcceleration:
        ((velocity.pitchVelocity - (previous.velocity.pitchVelocity ?? 0)) / elapsedMs) * 1000,
      rollAcceleration:
        ((velocity.rollVelocity - (previous.velocity.rollVelocity ?? 0)) / elapsedMs) * 1000,
    };
  }

  reset() {
    this.previous.clear();
  }
}
