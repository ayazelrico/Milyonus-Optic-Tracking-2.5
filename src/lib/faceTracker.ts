export interface TrackBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

interface Track extends TrackBox {
  id: number;
  lastSeen: number;
}

/**
 * Minimal greedy nearest-centroid tracker. MediaPipe's FaceLandmarker does not
 * expose a persistent face ID across frames (its per-face landmark smoothing
 * only holds for numFaces:1), so this assigns stable IDs by matching each
 * frame's detected boxes to the closest track from the previous frame.
 */
export class FaceTracker {
  private tracks: Track[] = [];
  private nextId = 1;

  constructor(
    private readonly maxAgeMs = 600,
    private readonly maxDistRatio = 0.85,
  ) {}

  /** Returns a track ID per input box, in the same order as `boxes`. */
  update(boxes: readonly TrackBox[], now: number): number[] {
    const ids = new Array<number>(boxes.length).fill(-1);
    const candidates: Array<{ bi: number; ti: number; dist: number }> = [];

    boxes.forEach((b, bi) => {
      this.tracks.forEach((t, ti) => {
        const dist = Math.hypot(b.cx - t.cx, b.cy - t.cy);
        const sizeRef = Math.max(b.w, b.h, t.w, t.h, 1);
        if (dist / sizeRef <= this.maxDistRatio) {
          candidates.push({ bi, ti, dist });
        }
      });
    });
    candidates.sort((a, b) => a.dist - b.dist);

    const usedBoxes = new Set<number>();
    const usedTracks = new Set<number>();
    for (const c of candidates) {
      if (usedBoxes.has(c.bi) || usedTracks.has(c.ti)) continue;
      usedBoxes.add(c.bi);
      usedTracks.add(c.ti);
      const t = this.tracks[c.ti]!;
      const b = boxes[c.bi]!;
      t.cx = b.cx;
      t.cy = b.cy;
      t.w = b.w;
      t.h = b.h;
      t.lastSeen = now;
      ids[c.bi] = t.id;
    }

    boxes.forEach((b, bi) => {
      if (ids[bi] !== -1) return;
      const id = this.nextId++;
      this.tracks.push({ id, cx: b.cx, cy: b.cy, w: b.w, h: b.h, lastSeen: now });
      ids[bi] = id;
    });

    this.tracks = this.tracks.filter((t) => now - t.lastSeen <= this.maxAgeMs);
    return ids;
  }

  reset() {
    this.tracks = [];
    this.nextId = 1;
  }
}
