export interface TrackBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export interface DetectionStabilityFrame {
  landmarkFaceCount: number;
  detectorFaceCount: number;
  matchedCount: number;
  candidateDetectorMisses: number;
  candidateUnmatchedDetections: number;
}

/**
 * Records agreement between the landmark model and the independent detector.
 * These are candidate misses/unmatched detections, not ground-truth labels.
 */
export class DetectionStabilityTracker {
  observe(
    landmarkFaceCount: number,
    detectorFaceCount: number,
    matchedCount: number,
  ): DetectionStabilityFrame {
    return {
      landmarkFaceCount,
      detectorFaceCount,
      matchedCount,
      candidateDetectorMisses: Math.max(0, landmarkFaceCount - matchedCount),
      candidateUnmatchedDetections: Math.max(0, detectorFaceCount - matchedCount),
    };
  }
}

export interface TrackStabilityFrame {
  observedCount: number;
  retainedTrackCount: number;
  newTrackCount: number;
  unmatchedPreviousTrackCount: number;
  activeTrackCount: number;
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
  private latestStats: TrackStabilityFrame = {
    observedCount: 0,
    retainedTrackCount: 0,
    newTrackCount: 0,
    unmatchedPreviousTrackCount: 0,
    activeTrackCount: 0,
  };

  constructor(
    private readonly maxAgeMs = 600,
    private readonly maxDistRatio = 0.85,
  ) {}

  /** Returns a track ID per input box, in the same order as `boxes`. */
  update(boxes: readonly TrackBox[], now: number): number[] {
    const previousTrackCount = this.tracks.length;
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
    this.latestStats = {
      observedCount: boxes.length,
      retainedTrackCount: usedTracks.size,
      newTrackCount: boxes.length - usedBoxes.size,
      unmatchedPreviousTrackCount: Math.max(0, previousTrackCount - usedTracks.size),
      activeTrackCount: this.tracks.length,
    };
    return ids;
  }

  getLastStats(): TrackStabilityFrame {
    return { ...this.latestStats };
  }

  reset() {
    this.tracks = [];
    this.nextId = 1;
    this.latestStats = {
      observedCount: 0,
      retainedTrackCount: 0,
      newTrackCount: 0,
      unmatchedPreviousTrackCount: 0,
      activeTrackCount: 0,
    };
  }
}
