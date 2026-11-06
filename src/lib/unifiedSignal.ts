import type { Emotion, Scores } from "@/lib/blendshapeEmotion";
import type { BlinkFrame } from "@/lib/blinkTracker";
import type { HeadMovementFrame } from "@/lib/headMovement";
import type { HeadPose } from "@/lib/facePose";
import type { GazeDirection } from "@/lib/focusTracking";
import type { MotionEvent } from "@/lib/motionEvents";
import type { TemporalFaceStateFrame } from "@/lib/temporalFaceState";

export interface UnifiedSignal {
  timestamp: number;
  trackId: number;
  confidence: number | null;
  face: {
    detected: boolean;
    landmarks: { count: number };
  };
  pose: {
    yaw: number;
    pitch: number;
    roll: number;
    depth: number;
  };
  eyes: {
    leftOpen: number | null;
    rightOpen: number | null;
    blink: BlinkFrame;
  };
  gaze: {
    direction: GazeDirection;
    score: number;
  };
  focus: {
    score: number;
  };
  expression: {
    dominant: Emotion;
    scores: Scores;
  };
  headMovement: HeadMovementFrame;
  temporalState: TemporalFaceStateFrame;
  events: MotionEvent[];
}

export interface UnifiedSignalInput {
  timestamp: number;
  trackId: number;
  confidence: number | null;
  pose: HeadPose;
  landmarkCount: number;
  blink: BlinkFrame;
  gaze: GazeDirection;
  focusScore: number;
  expression: Emotion;
  scores: Scores;
  headMovement: HeadMovementFrame;
  temporalState: TemporalFaceStateFrame;
  events: MotionEvent[];
}

/** Builds one stable, privacy-conscious signal envelope without raw landmark coordinates. */
export function createUnifiedSignal(input: UnifiedSignalInput): UnifiedSignal {
  return {
    timestamp: input.timestamp,
    trackId: input.trackId,
    confidence: input.confidence,
    face: {
      detected: true,
      landmarks: { count: input.landmarkCount },
    },
    pose: {
      yaw: input.pose.yaw,
      pitch: input.pose.pitch,
      roll: input.pose.roll,
      depth: input.pose.distance,
    },
    eyes: {
      leftOpen: input.blink.leftEyeOpen,
      rightOpen: input.blink.rightEyeOpen,
      blink: input.blink,
    },
    gaze: {
      direction: input.gaze,
      score: input.focusScore,
    },
    focus: { score: input.focusScore },
    expression: {
      dominant: input.expression,
      scores: input.scores,
    },
    headMovement: input.headMovement,
    temporalState: input.temporalState,
    events: input.events,
  };
}
