import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { HeadPose } from "@/lib/facePose";

const MIN_POSE_ALPHA = 0.15;
const MAX_POSE_ALPHA = 0.7;
const MOTION_ALPHA_GAIN = 0.025;

export class LandmarkProcessor {
  private smoothedLandmarks = new Map<number, NormalizedLandmark[]>();
  private smoothedPoses = new Map<number, HeadPose>();
  private readonly alpha: number;

  constructor(alpha: number = 0.3) {
    this.alpha = alpha;
  }

  /**
   * Applies Exponential Moving Average (EMA) smoothing to landmarks.
   * Formula: S_t = alpha * X_t + (1 - alpha) * S_{t-1}
   */
  smooth(faceId: number, landmarks: NormalizedLandmark[]): NormalizedLandmark[] {
    const prev = this.smoothedLandmarks.get(faceId);

    if (!prev) {
      this.smoothedLandmarks.set(faceId, [...landmarks]);
      return landmarks;
    }

    const smoothed = landmarks.map((p, i) => {
      const prevP = prev[i];
      return {
        x: this.alpha * p.x + (1 - this.alpha) * prevP.x,
        y: this.alpha * p.y + (1 - this.alpha) * prevP.y,
        z: this.alpha * p.z + (1 - this.alpha) * prevP.z,
      };
    });

    this.smoothedLandmarks.set(faceId, smoothed);
    return smoothed;
  }

  /**
   * Applies the same EMA policy to pose signals while preserving the raw pose.
   * Keeping both values makes responsiveness loss measurable instead of hidden.
   */
  smoothPose(faceId: number, raw: HeadPose): { raw: HeadPose; smoothed: HeadPose; alpha: number } {
    const previous = this.smoothedPoses.get(faceId);
    if (!previous) {
      this.smoothedPoses.set(faceId, { ...raw });
      return { raw, smoothed: raw, alpha: this.alpha };
    }

    const motion = Math.hypot(raw.yaw - previous.yaw, raw.pitch - previous.pitch, raw.roll - previous.roll);
    const alpha = Math.min(
      MAX_POSE_ALPHA,
      Math.max(MIN_POSE_ALPHA, MIN_POSE_ALPHA + motion * MOTION_ALPHA_GAIN),
    );
    const smoothed = {
      yaw: alpha * raw.yaw + (1 - alpha) * previous.yaw,
      pitch: alpha * raw.pitch + (1 - alpha) * previous.pitch,
      roll: alpha * raw.roll + (1 - alpha) * previous.roll,
      distance: alpha * raw.distance + (1 - alpha) * previous.distance,
    };
    this.smoothedPoses.set(faceId, smoothed);
    return { raw, smoothed, alpha };
  }

  private dist(p1: NormalizedLandmark, p2: NormalizedLandmark): number {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  /**
   * Eye Aspect Ratio (EAR)
   * Formula: (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
   */
  calculateEAR(landmarks: NormalizedLandmark[], eye: "left" | "right"): number {
    const indices = eye === "left"
      ? [33, 160, 158, 133, 153, 144]
      : [263, 387, 385, 362, 366, 373];

    const p = indices.map(i => landmarks[i]);
    const v1 = this.dist(p[1], p[5]);
    const v2 = this.dist(p[2], p[4]);
    const h = this.dist(p[0], p[3]);

    return (v1 + v2) / (2 * h);
  }

  /**
   * Mouth Aspect Ratio (MAR)
   * Formula: ||p_top - p_bottom|| / ||p_left - p_right||
   */
  calculateMAR(landmarks: NormalizedLandmark[]): number {
    const top = landmarks[13];
    const bottom = landmarks[14];
    const left = landmarks[61];
    const right = landmarks[291];

    return this.dist(top, bottom) / this.dist(left, right);
  }

  /**
   * Precise Gaze Vector
   * Calculates the iris center offset relative to eye corners.
   */
  calculateGazeVector(landmarks: NormalizedLandmark[]): { x: number; y: number } {
    // Left eye iris: 468, Right eye iris: 473
    // Left eye corners: 33, 133. Right eye corners: 362, 263.
    const leftIris = landmarks[468];
    const leftC1 = landmarks[33];
    const leftC2 = landmarks[133];
    const leftCenter = { x: (leftC1.x + leftC2.x) / 2, y: (leftC1.y + leftC2.y) / 2 };

    const rightIris = landmarks[473];
    const rightC1 = landmarks[362];
    const rightC2 = landmarks[263];
    const rightCenter = { x: (rightC1.x + rightC2.x) / 2, y: (rightC1.y + rightC2.y) / 2 };

    const vx = (leftIris.x - leftCenter.x + rightIris.x - rightCenter.x) / 2;
    const vy = (leftIris.y - leftCenter.y + rightIris.y - rightCenter.y) / 2;

    return { x: vx, y: vy };
  }

  reset() {
    this.smoothedLandmarks.clear();
    this.smoothedPoses.clear();
  }
}
