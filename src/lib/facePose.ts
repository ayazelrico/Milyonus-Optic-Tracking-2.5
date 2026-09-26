export interface HeadPose {
  /** Rotation around the vertical axis, in degrees. Positive = turned right. */
  yaw: number;
  /** Rotation around the horizontal axis, in degrees. Positive = looking down. */
  pitch: number;
  /** Rotation around the depth axis, in degrees. Positive = head tilted right. */
  roll: number;
  /** Relative distance from the camera, derived from the transform's Z translation. Larger = farther. */
  distance: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * Decomposes MediaPipe's facial transformation matrix (a flat, column-major
 * 4x4 matrix) into yaw/pitch/roll (YXZ Euler order) plus a depth proxy.
 * Mirrors the standard `Matrix4.setFromRotationMatrix(m, "YXZ")` decomposition,
 * which matches the column-major layout MediaPipe outputs.
 */
export function poseFromTransformMatrix(data: readonly number[]): HeadPose {
  const m11 = data[0]!;
  const m21 = data[1]!;
  const m31 = data[2]!;
  const m12 = data[4]!;
  const m22 = data[5]!;
  const m32 = data[6]!;
  const m13 = data[8]!;
  const m23 = data[9]!;
  const m33 = data[10]!;
  const tz = data[14]!;

  const pitch = Math.asin(-clamp(m23, -1, 1));
  let yaw: number;
  let roll: number;
  if (Math.abs(m23) < 0.9999999) {
    yaw = Math.atan2(m13, m33);
    roll = Math.atan2(m21, m22);
  } else {
    yaw = Math.atan2(-m31, m11);
    roll = 0;
  }

  return {
    yaw: toDeg(yaw),
    pitch: toDeg(pitch),
    roll: toDeg(roll),
    distance: Math.abs(tz),
  };
}
