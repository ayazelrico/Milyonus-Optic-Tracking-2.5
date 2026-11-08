import type { HeadPose } from "@/lib/facePose";

export interface HeadPoseVelocityFrame {
  yawVelocity: number | null;
  pitchVelocity: number | null;
  rollVelocity: number | null;
}

interface PoseSample {
  pose: HeadPose;
  at: number;
}

/** Converts smoothed head-pose deltas into degrees-per-second per track. */
export class HeadPoseVelocityTracker {
  private previous = new Map<number, PoseSample>();

  update(
    trackId: number,
    pose: HeadPose,
    at: number,
    confidenceWeight: number,
  ): HeadPoseVelocityFrame {
    if (confidenceWeight <= 0) {
      return { yawVelocity: null, pitchVelocity: null, rollVelocity: null };
    }

    const previous = this.previous.get(trackId);
    this.previous.set(trackId, { pose: { ...pose }, at });
    if (!previous) return { yawVelocity: 0, pitchVelocity: 0, rollVelocity: 0 };

    const elapsedMs = Math.max(1, at - previous.at);
    return {
      yawVelocity: ((pose.yaw - previous.pose.yaw) / elapsedMs) * 1000,
      pitchVelocity: ((pose.pitch - previous.pose.pitch) / elapsedMs) * 1000,
      rollVelocity: ((pose.roll - previous.pose.roll) / elapsedMs) * 1000,
    };
  }

  reset() {
    this.previous.clear();
  }
}
