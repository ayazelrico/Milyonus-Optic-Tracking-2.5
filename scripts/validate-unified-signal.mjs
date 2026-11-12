#!/usr/bin/env node
import fs from "node:fs";

const requiredTopLevel = [
  "timestamp",
  "trackId",
  "confidence",
  "face",
  "pose",
  "eyes",
  "gaze",
  "focus",
  "expression",
  "headMovement",
  "temporalState",
  "faceVelocity",
  "headPoseVelocity",
  "headPoseAcceleration",
  "focusEpisode",
  "events",
];
const requiredFace = ["detected", "landmarks"];
const requiredPose = ["yaw", "pitch", "roll", "depth"];
const requiredEyes = ["leftOpen", "rightOpen", "blink"];
const requiredGaze = ["direction", "score"];
const requiredExpression = ["dominant", "scores"];
const requiredMovement = ["intensity", "level", "angularSpeedDegPerSec"];
const requiredTemporalState = ["state", "previousState", "transition", "observationCount"];
const requiredFaceVelocity = ["vx", "vy", "speed"];
const requiredHeadPoseVelocity = ["yawVelocity", "pitchVelocity", "rollVelocity"];
const requiredHeadPoseAcceleration = ["yawAcceleration", "pitchAcceleration", "rollAcceleration"];
const requiredFocusEpisode = ["active", "startedAt", "durationMs", "completedDurationMs"];

function fail(message) {
  console.error(`Unified signal validation failed: ${message}`);
  process.exitCode = 1;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function requireKeys(object, keys, path) {
  if (!object || typeof object !== "object" || Array.isArray(object)) {
    fail(`${path} must be an object`);
    return false;
  }
  let valid = true;
  for (const key of keys) {
    if (!hasOwn(object, key)) {
      fail(`${path}.${key} is missing`);
      valid = false;
    }
  }
  return valid;
}

function validateSignal(signal, index) {
  const path = `unifiedSignals[${index}]`;
  let valid = requireKeys(signal, requiredTopLevel, path);
  if (!valid) return false;
  if (!Number.isFinite(signal.timestamp))
    (fail(`${path}.timestamp must be finite`), (valid = false));
  if (!Number.isInteger(signal.trackId))
    (fail(`${path}.trackId must be an integer`), (valid = false));
  if (signal.face.detected !== true) (fail(`${path}.face.detected must be true`), (valid = false));
  valid = requireKeys(signal.face, requiredFace, `${path}.face`) && valid;
  valid = requireKeys(signal.pose, requiredPose, `${path}.pose`) && valid;
  valid = requireKeys(signal.eyes, requiredEyes, `${path}.eyes`) && valid;
  valid = requireKeys(signal.gaze, requiredGaze, `${path}.gaze`) && valid;
  valid = requireKeys(signal.focus, ["score"], `${path}.focus`) && valid;
  valid = requireKeys(signal.expression, requiredExpression, `${path}.expression`) && valid;
  valid = requireKeys(signal.headMovement, requiredMovement, `${path}.headMovement`) && valid;
  valid =
    requireKeys(signal.temporalState, requiredTemporalState, `${path}.temporalState`) && valid;
  valid = requireKeys(signal.faceVelocity, requiredFaceVelocity, `${path}.faceVelocity`) && valid;
  valid =
    requireKeys(signal.headPoseVelocity, requiredHeadPoseVelocity, `${path}.headPoseVelocity`) &&
    valid;
  valid =
    requireKeys(
      signal.headPoseAcceleration,
      requiredHeadPoseAcceleration,
      `${path}.headPoseAcceleration`,
    ) && valid;
  valid = requireKeys(signal.focusEpisode, requiredFocusEpisode, `${path}.focusEpisode`) && valid;
  if (!Array.isArray(signal.events)) (fail(`${path}.events must be an array`), (valid = false));
  if (!signal.face.landmarks || Object.keys(signal.face.landmarks).some((key) => key !== "count")) {
    fail(`${path}.face.landmarks may contain only count`);
    valid = false;
  }
  if (!Number.isInteger(signal.face.landmarks?.count) || signal.face.landmarks.count < 0) {
    fail(`${path}.face.landmarks.count must be a non-negative integer`);
    valid = false;
  }
  return valid;
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node scripts/validate-unified-signal.mjs <telemetry.json>");
  process.exit(2);
}

const payload = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const signals = payload.unifiedSignals;
if (!Array.isArray(signals)) {
  fail("unifiedSignals must be an array");
} else {
  const activeTrackIds = payload.activeTrackIds;
  if (activeTrackIds !== undefined) {
    if (!Array.isArray(activeTrackIds)) fail("activeTrackIds must be an array");
    else if (new Set(activeTrackIds).size !== signals.length) {
      fail(
        `active track count ${new Set(activeTrackIds).size} does not match signal count ${signals.length}`,
      );
    }
  }
  const trackIds = new Set();
  signals.forEach((signal, index) => {
    if (validateSignal(signal, index)) {
      if (trackIds.has(signal.trackId)) fail(`duplicate trackId ${signal.trackId}`);
      trackIds.add(signal.trackId);
    }
  });
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`Unified signal validation passed: ${signals.length} signal(s)`);
