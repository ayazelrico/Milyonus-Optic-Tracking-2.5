#!/usr/bin/env node

/**
 * Milyonus Optic Tracking baseline benchmark.
 *
 * This script never invents measurements. Metrics are calculated from an
 * exported session CSV when available; unavailable metrics are reported as
 * null with an explanatory note.
 */

import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { spawnSync } from "node:child_process";
import process from "node:process";

const DEFAULT_OUTPUT = "artifacts/baseline-v2.5.json";
const KNOWN_NUMERIC_FIELDS = [
  "fps",
  "inference_latency_ms",
  "confidence",
  "focus_score",
  "cpu_percent",
  "memory_mb",
  "track_id",
  "second",
  "has_face",
];

function parseArgs(argv) {
  const args = {
    input: null,
    landmarks: null,
    output: DEFAULT_OUTPUT,
    scenario: "unspecified",
    skipBuild: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--input") args.input = argv[++index];
    else if (token === "--landmarks") args.landmarks = argv[++index];
    else if (token === "--output") args.output = argv[++index];
    else if (token === "--scenario") args.scenario = argv[++index];
    else if (token === "--skip-build") args.skipBuild = true;
    else if (token === "--help" || token === "-h") {
      console.log(`Usage: node scripts/baseline.mjs [options]

Options:
  --input <csv>       Session CSV exported by the application
  --landmarks <json>  Landmark frames for jitter analysis
  --output <json>     Output path (default: ${DEFAULT_OUTPUT})
  --scenario <name>   Test scenario label
  --skip-build        Do not measure the local production build
  --help              Show this help

Example:
  npm run baseline -- --input artifacts/normal-light.csv --scenario normal-light`);
      process.exit(0);
    }
  }
  return args;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.trim().toLowerCase());
  return rows
    .slice(1)
    .map((values) =>
      Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""])),
    );
}

function numberValues(rows, field) {
  return rows.map((row) => Number(row[field])).filter((value) => Number.isFinite(value));
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function percentile(values, percentileValue) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * percentileValue;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function rounded(value, digits = 4) {
  return value === null ? null : Number(value.toFixed(digits));
}

function metricSummary(rows) {
  const result = {};
  const faceValues = rows
    .map((row) => row.has_face)
    .filter((value) => value === "0" || value === "1");
  const faceCount = faceValues.filter((value) => value === "1").length;
  const confidence = numberValues(rows, "confidence");
  const focus = numberValues(rows, "focus_score");
  const fps = numberValues(rows, "fps");
  const latency = numberValues(rows, "inference_latency_ms");
  const cpu = numberValues(rows, "cpu_percent");
  const memory = numberValues(rows, "memory_mb");

  result.sample_count = rows.length;
  result.face_detection_rate = faceValues.length ? rounded(faceCount / faceValues.length) : null;
  result.confidence = {
    sample_count: confidence.length,
    mean: rounded(mean(confidence)),
    p50: rounded(percentile(confidence, 0.5)),
    p95: rounded(percentile(confidence, 0.95)),
  };
  result.focus_score = {
    sample_count: focus.length,
    mean: rounded(mean(focus)),
    stability_mean_absolute_delta: rounded(
      mean(focus.slice(1).map((value, index) => Math.abs(value - focus[index]))),
    ),
  };
  result.fps = {
    sample_count: fps.length,
    mean: rounded(mean(fps)),
    p05: rounded(percentile(fps, 0.05)),
  };
  result.inference_latency_ms = {
    sample_count: latency.length,
    mean: rounded(mean(latency)),
    p95: rounded(percentile(latency, 0.95)),
  };
  result.cpu_percent = {
    sample_count: cpu.length,
    mean: rounded(mean(cpu)),
    p95: rounded(percentile(cpu, 0.95)),
  };
  result.memory_mb = {
    sample_count: memory.length,
    mean: rounded(mean(memory)),
    peak: memory.length ? rounded(Math.max(...memory)) : null,
  };

  const gazes = rows.map((row) => row.gaze).filter(Boolean);
  let gazeSwitches = 0;
  for (let index = 1; index < gazes.length; index += 1) {
    if (gazes[index] !== gazes[index - 1]) gazeSwitches += 1;
  }
  result.gaze = {
    sample_count: gazes.length,
    switch_count: gazes.length > 1 ? gazeSwitches : null,
    switches_per_minute:
      gazes.length > 1 && rows.length > 1 ? rounded((gazeSwitches / rows.length) * 60) : null,
  };

  const trackIds = rows.map((row) => row.track_id).filter((value) => value !== "");
  result.track_id = {
    sample_count: trackIds.length,
    distinct_ids: trackIds.length ? new Set(trackIds).size : null,
    continuity_rate:
      trackIds.length > 1
        ? rounded(
            trackIds.slice(1).filter((value, index) => value === trackIds[index]).length /
              (trackIds.length - 1),
          )
        : null,
  };

  result.available_fields = Object.keys(rows[0] ?? {}).filter(
    (field) => KNOWN_NUMERIC_FIELDS.includes(field) || ["gaze", "timestamp"].includes(field),
  );
  result.notes = [
    "Metrics are null when the input CSV does not contain the required field.",
    "A real-camera run is required for valid model performance measurements.",
  ];
  return result;
}

function landmarkJitterSummary(frames) {
  const distances = [];
  const pointsPerFrame = new Set();
  const previousByTrack = new Map();

  for (const frame of frames) {
    if (!Array.isArray(frame.landmarks) || frame.landmarks.length === 0) continue;
    pointsPerFrame.add(frame.landmarks.length);
    const trackId = String(frame.track_id ?? "primary");
    const previous = previousByTrack.get(trackId);
    if (previous && previous.length === frame.landmarks.length) {
      for (let index = 0; index < frame.landmarks.length; index += 1) {
        const current = frame.landmarks[index];
        const prior = previous[index];
        if (!current || !prior) continue;
        const dx = Number(current.x) - Number(prior.x);
        const dy = Number(current.y) - Number(prior.y);
        const dz = Number(current.z ?? 0) - Number(prior.z ?? 0);
        const distance = Math.hypot(dx, dy, dz);
        if (Number.isFinite(distance)) distances.push(distance);
      }
    }
    previousByTrack.set(trackId, frame.landmarks);
  }

  return {
    frame_count: frames.length,
    track_count: previousByTrack.size,
    landmark_count: pointsPerFrame.size === 1 ? [...pointsPerFrame][0] : null,
    transition_count: distances.length,
    mean_displacement: rounded(mean(distances)),
    p95_displacement: rounded(percentile(distances, 0.95)),
    max_displacement: distances.length ? rounded(Math.max(...distances)) : null,
    coordinate_space: "normalized MediaPipe coordinates",
    notes: [
      "Jitter is the frame-to-frame Euclidean displacement of corresponding landmarks.",
      "Compare runs with the same subject, camera, distance, lighting, and frame rate.",
    ],
  };
}

function measureBuild() {
  if (!existsSync("package.json")) return { status: "skipped", reason: "package.json not found" };
  const started = performance.now();
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(command, ["run", "build"], { encoding: "utf8" });
  return {
    status: result.status === 0 ? "passed" : "failed",
    duration_ms: rounded(performance.now() - started, 2),
    exit_code: result.status,
    stderr_tail: (result.stderr || "").trim().slice(-1000),
  };
}

const args = parseArgs(process.argv.slice(2));
const rows = args.input && existsSync(args.input) ? parseCsv(readFileSync(args.input, "utf8")) : [];
const landmarkFrames =
  args.landmarks && existsSync(args.landmarks)
    ? JSON.parse(readFileSync(args.landmarks, "utf8"))
    : null;
const report = {
  schema_version: "1.0.0",
  generated_at: new Date().toISOString(),
  model_version: "2.5",
  scenario: args.scenario,
  input: args.input,
  build: args.skipBuild
    ? { status: "skipped", reason: "disabled by --skip-build" }
    : measureBuild(),
  metrics: rows.length
    ? metricSummary(rows)
    : {
        sample_count: 0,
        notes: [
          "No session CSV was supplied. Run the browser with a real camera, export CSV, and pass it with --input.",
        ],
      },
};

report.metrics.landmark_jitter = landmarkFrames
  ? landmarkJitterSummary(landmarkFrames)
  : {
      frame_count: 0,
      transition_count: 0,
      mean_displacement: null,
      p95_displacement: null,
      max_displacement: null,
      notes: ["Pass --landmarks <json> to calculate frame-to-frame landmark jitter."],
    };

mkdirSync(args.output.split("/").slice(0, -1).join("/") || ".", { recursive: true });
writeFileSync(args.output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Baseline report written to ${args.output}`);
console.log(`Build: ${report.build.status}`);
console.log(`Session samples: ${report.metrics.sample_count}`);
