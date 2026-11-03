import type { Emotion } from "@/lib/blendshapeEmotion";
import type { HeadPose } from "@/lib/facePose";
import type { GazeDirection } from "@/lib/focusTracking";
import type { BlinkFrame } from "@/lib/blinkTracker";

export type MotionEventType =
  | "HEAD_TURN"
  | "HEAD_NOD"
  | "BLINK"
  | "FACE_LOST"
  | "FACE_FOUND"
  | "GAZE_CHANGE"
  | "EXPRESSION_CHANGE";

export interface MotionEvent {
  type: MotionEventType;
  trackId: number;
  at: number;
  durationMs?: number;
  from?: string;
  to?: string;
}

interface TrackState {
  pose: HeadPose;
  at: number;
  gaze: GazeDirection;
  expression: Emotion;
  present: boolean;
  lastTurnAt: number;
  lastNodAt: number;
}

const TURN_DELTA_DEG = 12;
const NOD_DELTA_DEG = 8;
const MOTION_COOLDOWN_MS = 500;

/** Converts per-frame signals into debounced, track-scoped semantic events. */
export class MotionEventEngine {
  private tracks = new Map<number, TrackState>();

  update(
    trackId: number,
    pose: HeadPose,
    at: number,
    gaze: GazeDirection,
    expression: Emotion,
    blink: BlinkFrame,
    confidenceWeight: number,
  ): MotionEvent[] {
    const previous = this.tracks.get(trackId);
    const events: MotionEvent[] = [];
    const usable = confidenceWeight > 0;

    if (!previous) {
      this.tracks.set(trackId, {
        pose: { ...pose },
        at,
        gaze,
        expression,
        present: true,
        lastTurnAt: -Infinity,
        lastNodAt: -Infinity,
      });
      events.push({ type: "FACE_FOUND", trackId, at });
      return events;
    }

    if (!previous.present) {
      events.push({ type: "FACE_FOUND", trackId, at });
      previous.present = true;
    }

    if (usable) {
      const yawDelta = pose.yaw - previous.pose.yaw;
      const pitchDelta = pose.pitch - previous.pose.pitch;
      if (Math.abs(yawDelta) >= TURN_DELTA_DEG && at - previous.lastTurnAt >= MOTION_COOLDOWN_MS) {
        events.push({ type: "HEAD_TURN", trackId, at });
        previous.lastTurnAt = at;
      }
      if (Math.abs(pitchDelta) >= NOD_DELTA_DEG && at - previous.lastNodAt >= MOTION_COOLDOWN_MS) {
        events.push({ type: "HEAD_NOD", trackId, at });
        previous.lastNodAt = at;
      }
      if (previous.gaze !== gaze && previous.gaze !== "none" && gaze !== "none") {
        events.push({ type: "GAZE_CHANGE", trackId, at, from: previous.gaze, to: gaze });
      }
      if (previous.expression !== expression) {
        events.push({
          type: "EXPRESSION_CHANGE",
          trackId,
          at,
          from: previous.expression,
          to: expression,
        });
      }
      if (blink.blinkDurationMs != null) {
        events.push({ type: "BLINK", trackId, at, durationMs: blink.blinkDurationMs });
      }
      previous.pose = { ...pose };
      previous.at = at;
      previous.gaze = gaze;
      previous.expression = expression;
    }

    return events;
  }

  observeMissing(activeTrackIds: ReadonlySet<number>, at: number): MotionEvent[] {
    const events: MotionEvent[] = [];
    for (const [trackId, state] of this.tracks) {
      if (activeTrackIds.has(trackId) || !state.present) continue;
      state.present = false;
      events.push({ type: "FACE_LOST", trackId, at });
    }
    return events;
  }

  reset() {
    this.tracks.clear();
  }
}
