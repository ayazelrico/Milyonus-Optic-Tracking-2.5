export interface FaceVelocityFrame {
  vx: number | null;
  vy: number | null;
  speed: number | null;
}

interface CentroidSample {
  cx: number;
  cy: number;
  at: number;
}

/** Converts tracked face-centroid displacement into pixels-per-second velocity. */
export class FaceVelocityTracker {
  private previous = new Map<number, CentroidSample>();

  update(
    trackId: number,
    cx: number,
    cy: number,
    at: number,
    confidenceWeight: number,
  ): FaceVelocityFrame {
    if (confidenceWeight <= 0) return { vx: null, vy: null, speed: null };

    const previous = this.previous.get(trackId);
    this.previous.set(trackId, { cx, cy, at });
    if (!previous) return { vx: 0, vy: 0, speed: 0 };

    const elapsedMs = Math.max(1, at - previous.at);
    const vx = ((cx - previous.cx) / elapsedMs) * 1000;
    const vy = ((cy - previous.cy) / elapsedMs) * 1000;
    return { vx, vy, speed: Math.hypot(vx, vy) };
  }

  reset() {
    this.previous.clear();
  }
}
