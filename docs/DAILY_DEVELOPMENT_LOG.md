# Daily Development Log

## Day 1 — Baseline

- **Date:** 2026-09-27
- **Feature:** Reproducible baseline report for Milyonus Optic Tracking 2.5
- **Problem:** The project had a benchmark harness, but no committed Day 1 baseline artifact documenting the current state of the 2.5 codebase.
- **Change:** Ran the baseline harness against the current `main` commit and committed the resulting JSON report as `artifacts/baseline-v2.5.json`. The report captures the production build result and preserves unavailable camera metrics as explicit missing data.
- **Expected improvement:** Establish a versioned reference point for future performance comparisons without introducing synthetic measurements.
- **Actual result:** The production build passed. Build duration was `977.77 ms` in this sandbox run. No real-camera session CSV was available, so face detection rate, FPS, inference latency, confidence, focus, gaze, track continuity, CPU, and memory metrics remain unmeasured.
- **Metric:** `build.status = passed`; `build.duration_ms = 977.77`; `session.sample_count = 0`.
- **Regression:** No regression observed in the production build. Real-camera behavior remains unverified and requires manual validation.
- **Next action:** Run the browser with a real camera for each controlled scenario, export the session CSV, and rerun the baseline harness to populate runtime metrics. Then proceed to Day 2: landmark quality and jitter measurement.

## Day 2 — Landmark Quality

- **Date:** 2026-09-28
- **Feature:** Frame-to-frame landmark jitter measurement
- **Problem:** The baseline report measured session-level signals but could not quantify whether the 478 landmarks were unnecessarily moving while a subject remained still.
- **Change:** Extended `scripts/baseline.mjs` with an optional `--landmarks <json>` input. For each stable `track_id`, corresponding landmarks are compared across adjacent frames using normalized 3D Euclidean displacement; mean, p95, and maximum displacement are reported.
- **Expected improvement:** Establish an objective landmark-stability metric that can be compared before and after smoothing or other measurement changes.
- **Actual result:** The new analysis path passed deterministic fixture validation. No real-camera landmark frame capture was available in this run, so production jitter remains unmeasured.
- **Metric:** Fixture path reported the expected displacement values; production `mean_displacement`, `p95_displacement`, and `max_displacement` require a stationary-subject landmark JSON export.
- **Regression:** The production build and baseline CLI remained functional. No camera regression assessment was possible.
- **Next action:** Capture at least 60 seconds of stationary-subject landmark frames under controlled lighting and record the resulting jitter metrics before proceeding to temporal smoothing.

## Day 3 — Temporal Smoothing

- **Date:** 2026-09-29
- **Feature:** Raw and EMA-smoothed head-pose signals
- **Problem:** The existing EMA path smoothed landmark-derived boxes, but pose values used by focus and expression logic were still represented only as raw values. Stability and responsiveness could not be compared explicitly.
- **Change:** Added per-track pose EMA smoothing with the existing default alpha of `0.3`. Each `FaceReading` now retains `rawPose` and exposes the smoothed pose as `pose`; the smoother also resets pose state together with landmark state.
- **Expected improvement:** Reduce frame-to-frame yaw, pitch, roll, and distance noise while preserving raw values for responsiveness and regression analysis.
- **Actual result:** The implementation compiled successfully in the production build. No real-camera motion sequence was available, so numerical stability gain and lag remain unmeasured.
- **Metric:** Runtime alpha is `0.3`; raw-versus-smoothed pose deltas require a real-camera CSV or telemetry capture.
- **Regression:** The build remained successful. Camera responsiveness, focus classification, and pose lag require manual validation.
- **Next action:** Run a controlled slow-motion and fast-motion camera session, compare raw and smoothed pose traces, then tune only if stability improves without unacceptable lag. Proceed to Day 4 adaptive smoothing afterward.

## Day 4 — Adaptive Smoothing

- **Date:** 2026-09-30
- **Feature:** Motion-adaptive pose EMA
- **Problem:** A fixed pose alpha applies the same amount of smoothing to stationary and fast-moving subjects, forcing a trade-off between stability and responsiveness.
- **Change:** Pose EMA now derives alpha from frame-to-frame yaw, pitch, and roll motion. Slow movement uses a `0.15` smoothing floor; faster movement increases alpha up to `0.7`. Each `FaceReading` records the applied `smoothingAlpha`.
- **Expected improvement:** Suppress stationary noise more strongly while reducing lag during rapid head movement.
- **Actual result:** The adaptive path compiled successfully in the production build. No real-camera motion sequence was available, so stability improvement and responsiveness change remain unmeasured.
- **Metric:** `MIN_POSE_ALPHA = 0.15`; `MAX_POSE_ALPHA = 0.7`; `MOTION_ALPHA_GAIN = 0.025`; runtime alpha is exposed per reading.
- **Regression:** Production build passed. Camera motion behavior, focus transitions, and alpha distribution require manual validation.
- **Next action:** Capture stationary, slow-turn, and fast-turn sessions; compare jitter, raw-to-smoothed lag, focus transitions, and observed alpha values before changing the bounds. Proceed to Day 5 confidence filtering afterward.

## Day 5 — Confidence Filtering

- **Date:** 2026-10-01
- **Feature:** Confidence-weighted pose, gaze, focus, and expression measurements
- **Problem:** Detector confidence was displayed and recorded but did not reduce the influence of uncertain detections on downstream attention and expression metrics.
- **Change:** Added a confidence weight: detections below `0.30` are rejected from gaze and focus calculations; `0.30–0.75` detections are pulled toward neutral and receive proportional expression suppression; `>=0.75` detections receive full weight. Raw smoothed pose remains available for diagnostics.
- **Expected improvement:** Reduce false gaze transitions, unstable focus scores, and overconfident expression labels when the detector is uncertain.
- **Actual result:** The confidence-filtered path compiled successfully in the production build. No real-camera low-confidence sequence was available, so behavior under occlusion or poor lighting remains unmeasured.
- **Metric:** `LOW_CONFIDENCE_CUTOFF = 0.30`; `FULL_CONFIDENCE_THRESHOLD = 0.75`; intermediate pose and expression weight is linearly scaled.
- **Regression:** Production build passed. Manual validation is still required for partial occlusion, low light, glasses, and face-at-edge scenarios.
- **Next action:** Run controlled low-confidence camera scenarios and compare rejected frames, gaze switching, focus stability, and expression false positives. Proceed to Day 6 face-detection stability afterward.

## Day 6 — Face Detection Stability

- **Date:** 2026-10-02
- **Feature:** Per-frame detector agreement telemetry
- **Problem:** The landmark model and independent face detector were matched for confidence, but their disagreements were not preserved for later stability analysis.
- **Change:** Added per-frame telemetry containing landmark face count, detector face count, matched count, candidate detector misses, and candidate unmatched detections. The data is written to the existing high-resolution recorder for every frame, including frames with no detected face.
- **Expected improvement:** Make edge-of-frame, turned-away, distant, and partially occluded detection behavior measurable without confusing model disagreement with ground-truth false positives or false negatives.
- **Actual result:** The telemetry path compiled successfully in the production build. No real-camera scenario was available, so candidate miss rates remain unmeasured.
- **Metric:** `candidateDetectorMisses = landmarkFaceCount - matchedCount`; `candidateUnmatchedDetections = detectorFaceCount - matchedCount`, both clamped at zero per frame.
- **Regression:** Production build passed. Ground-truth accuracy and scenario-specific detection stability require manual camera validation.
- **Next action:** Run controlled edge, turned, distant, and occluded-face sessions; aggregate candidate miss rates and compare them under identical conditions. Proceed to Day 7 track-ID stability afterward.

## Day 7 — Track-ID Stability

- **Date:** 2026-10-03
- **Feature:** Per-frame track continuity telemetry
- **Problem:** The greedy tracker assigned IDs, but continuity breaks were not separately observable during fast movement, multi-person crossings, exit/re-entry, or face intersections.
- **Change:** Added tracker statistics for observed faces, retained matches, newly created tracks, unmatched previous tracks, and active tracks. These statistics are recorded for every high-resolution frame, including no-face frames.
- **Expected improvement:** Make ID churn measurable before changing matching thresholds or introducing a more complex tracker.
- **Actual result:** The telemetry path compiled successfully in the production build. No labeled or real-camera sequence was available, so ID continuity rates remain unmeasured.
- **Metric:** `newTrackCount` is an observable continuity break candidate; `retainedTrackCount`, `unmatchedPreviousTrackCount`, and `activeTrackCount` describe tracker state per frame.
- **Regression:** Production build passed. A new track is not treated as proof of an identity switch; labeled video review is required for that claim.
- **Next action:** Run fast-head-motion, two-person crossing, exit/re-entry, and face-intersection sessions; compare new-track and retained-track rates before tuning the tracker. Proceed to Day 8 occlusion handling afterward.

## Day 8 — Occlusion Handling

- **Date:** 2026-10-04
- **Feature:** Short-term constant-velocity track prediction
- **Problem:** During a brief partial occlusion, matching against the last observed center alone could reject the returning face after it moved, causing an avoidable new track ID.
- **Change:** Each track now maintains a smoothed center velocity and predicts its center across the missing interval before applying the existing distance gate. Matches after gaps longer than `50 ms` are counted as occlusion reacquisitions; the existing `600 ms` lifetime remains unchanged.
- **Expected improvement:** Preserve the same track ID across short occlusions without extending track lifetime or accepting arbitrarily distant matches.
- **Actual result:** The prediction and reacquisition telemetry path compiled successfully in the production build. No real-camera occlusion sequence was available, so ID preservation improvement remains unmeasured.
- **Metric:** `occlusionReacquiredCount` per frame; prediction is bounded by the existing `maxDistRatio = 0.85` and `maxAgeMs = 600` defaults.
- **Regression:** Production build passed. Fast motion, crossing faces, partial occlusion, and long disappearance require manual validation.
- **Next action:** Run controlled partial-occlusion and moving-face sessions; compare reacquisition and new-track rates against Day 7 telemetry before adjusting prediction or grace-window parameters. Proceed to Day 9 blink detection afterward.

## Day 9 — Blink Detection

- **Date:** 2026-10-05
- **Feature:** Per-track EAR blink events and rolling blink frequency
- **Problem:** The application calculated EAR for display but did not convert the signal into time-bounded blink events or a frequency metric.
- **Change:** Added a per-track blink state machine. Blink start occurs below mean EAR `0.18`; completion occurs above `0.21` after a valid `50–500 ms` closure. Each event records start state, duration, cumulative count, and rolling one-minute frequency. Confidence-weight `0` frames do not advance state.
- **Expected improvement:** Provide a reproducible blink event signal while avoiding single-frame noise and low-confidence false events.
- **Actual result:** The blink telemetry path compiled successfully in the production build. No real-camera blink sequence was available, so precision, recall, duration accuracy, and frequency remain unmeasured. The optional local TypeScript fixture was not run because the repository does not include a local `esbuild` binary and `npx` requested an unapproved package installation.
- **Metric:** Left/right EAR, `blinkStartedAt`, `blinkDurationMs`, `blinkCount`, and `blinkFrequencyPerMinute` are recorded per primary face frame.
- **Regression:** Production build passed. Lighting, glasses, partial occlusion, and rapid repeated blinks require manual validation.
- **Next action:** Capture labeled open/closed-eye sequences and compare event timing, duration, and rolling frequency; proceed to Day 10 eye-openness metrics afterward.

## Day 10 — Eye Openness

- **Date:** 2026-10-06
- **Feature:** Separate left/right eye openness telemetry
- **Problem:** EAR was available for blink detection, but the application did not expose independent left-eye, right-eye, or mean eye-openness values.
- **Change:** Added `leftEyeOpen`, `rightEyeOpen`, and `eyeOpenness` to each blink frame. These fields use the corresponding EAR values when confidence weight is usable; low-confidence frames preserve raw EAR diagnostics but return `null` openness fields.
- **Expected improvement:** Make asymmetric eye closure, gradual eye opening, and per-eye blink quality measurable without conflating the two eyes.
- **Actual result:** The eye-openness telemetry path compiled successfully in the production build. No real-camera eye sequence was available, so openness calibration and accuracy remain unmeasured.
- **Metric:** Left EAR, right EAR, mean `eyeOpenness`, and `confidenceWeight` are recorded per tracked face frame.
- **Regression:** Production build passed. Glasses, head rotation, partial occlusion, and left/right landmark asymmetry require manual validation.
- **Next action:** Capture controlled open, closed, asymmetric, and head-rotated eye sequences; compare left/right openness traces before proceeding to Day 11 eye symmetry.

## Day 11 — Eye Symmetry

- **Date:** 2026-10-07
- **Feature:** Normalized left/right eye symmetry metrics
- **Problem:** Separate eye-openness values were available, but camera angle and landmark noise could not be summarized as a scale-independent asymmetry signal.
- **Change:** Added `eyeSymmetryDifference = abs(leftEAR - rightEAR) / max(meanEAR, 0.001)`, clamped to `[0, 1]`, and the complementary `eyeSymmetryScore = 1 - difference`. Both fields are `null` when confidence weight is zero.
- **Expected improvement:** Make left/right landmark disagreement measurable across different face sizes and distinguish raw asymmetry from a normalized stability score.
- **Actual result:** The symmetry telemetry path compiled successfully in the production build. No real-camera angle or landmark-noise sequence was available, so calibration and accuracy remain unmeasured.
- **Metric:** `eyeSymmetryDifference` in `[0, 1]`; `eyeSymmetryScore` in `[0, 1]`; low-confidence frames are excluded.
- **Regression:** Production build passed. Head rotation, asymmetric blinking, glasses, and partial occlusion require manual validation.
- **Next action:** Capture frontal, rotated, asymmetric-blink, and occluded-eye sequences; compare symmetry against labeled conditions before proceeding to Day 12 head movement intensity.

## Day 12 — Head Movement Intensity

- **Date:** 2026-10-08
- **Feature:** Time-normalized head movement intensity
- **Problem:** Smoothed pose values were available, but frame-to-frame movement was not exposed as a continuous, frame-rate-aware metric or a low/medium/high band.
- **Change:** Added a per-track head movement tracker using smoothed yaw, pitch, and roll deltas normalized by elapsed time. Intensity is clamped to `[0, 1]` against `120 deg/s`, with `low < 0.25`, `medium < 0.60`, and `high >= 0.60`. Confidence-zero frames return `null` and do not update state.
- **Expected improvement:** Quantify stillness versus active head movement while reducing sensitivity to variable frame rates and uncertain detections.
- **Actual result:** The head movement telemetry path compiled successfully in the production build. No real-camera movement sequence was available, so calibration and band accuracy remain unmeasured.
- **Metric:** `angularSpeedDegPerSec`, continuous `intensity`, and `level` are recorded per primary face frame.
- **Regression:** Production build passed. Slow turns, fast turns, nods, shakes, and variable frame-rate behavior require manual validation.
- **Next action:** Capture labeled slow, medium, fast, nodding, and shaking sequences; compare intensity bands before proceeding to Day 13 motion events.

## Day 13 — Motion Events

- **Date:** 2026-11-03
- **Feature:** Track-scoped semantic motion event engine
- **Problem:** Head movement intensity and blink signals existed independently, but the telemetry stream did not expose discrete head, face-presence, gaze, expression, and blink events.
- **Change:** Added a debounced event engine that emits `HEAD_TURN`, `HEAD_NOD`, `BLINK`, `FACE_FOUND`, `FACE_LOST`, `GAZE_CHANGE`, and `EXPRESSION_CHANGE`. Turn and nod events use smoothed pose deltas with a `500 ms` cooldown; blink events reuse validated blink duration. Events include track ID and timestamp, with optional transition or duration data.
- **Expected improvement:** Make temporal behavior queryable as semantic events without changing the underlying continuous measurements.
- **Actual result:** The event engine and recorder integration compiled successfully in the production build, and the new `motionEvents.ts` file passed targeted ESLint. The repository-wide lint command still fails on 33 pre-existing formatting/type issues in legacy files, so those unrelated files were not reformatted. No real-camera or labeled sequence was available; event precision, recall, and threshold calibration remain unmeasured.
- **Metric:** Per-frame `events` array containing event type, track ID, timestamp, and optional `from`, `to`, or `durationMs` fields.
- **Regression:** Production build and `git diff --check` passed; targeted lint passed. Full repository lint remains red due to pre-existing issues. Fast head turns, nods, brief face loss, gaze transitions, expression transitions, and multi-face sessions require manual validation.
- **Next action:** Capture labeled multi-face and motion sequences; compare emitted events with annotations before proceeding to Day 14 unified signal schema.

## Day 14 — Unified Signal Object

- **Date:** 2026-11-04
- **Feature:** Unified per-track signal envelope
- **Problem:** Pose, eyes, gaze, focus, expression, movement, and events were available as separate recorder fields, making downstream consumers dependent on implementation-specific joins.
- **Change:** Added `UnifiedSignal` and `createUnifiedSignal`, then recorded a `unifiedSignals` array for every active track. The envelope includes timestamp, track ID, confidence, face presence, landmark count, pose, eyes/blink, gaze, focus, expression, head movement, and track-scoped events. Raw landmark coordinates are intentionally not copied into persistent telemetry.
- **Expected improvement:** Give analytics and future API consumers one stable schema while preserving existing recorder fields for backward compatibility and limiting sensitive payload duplication.
- **Actual result:** The unified signal path compiled successfully in the production build, and `unifiedSignal.ts` passed targeted ESLint. No real-camera or exported telemetry sample was available, so live schema serialization remains unverified against captured data.
- **Metric:** `unifiedSignals` count should equal the number of active tracked faces per frame; each signal contains the documented top-level fields.
- **Regression:** Existing primary recorder fields remain unchanged. Production build, `git diff --check`, and targeted lint passed. Raw landmark privacy boundary is explicit and requires review in an exported session.
- **Next action:** Export a multi-face telemetry session, validate schema completeness and serialization, then proceed to Day 15 baseline quality gate.

## Day 15 — Unified Signal Quality Gate

- **Date:** 2026-11-05
- **Feature:** Deterministic unified-signal schema validator
- **Problem:** The unified signal contract was documented but had no repeatable automated gate for required fields, track cardinality, timestamp validity, or the landmark privacy boundary.
- **Change:** Added `scripts/validate-unified-signal.mjs` and the `validate:unified` package command. The validator checks nested schema keys, unique integer track IDs, optional active-track count parity, finite timestamps, non-negative landmark counts, and rejects landmark payload keys other than `count`.
- **Expected improvement:** Detect malformed telemetry and accidental raw-landmark persistence before downstream analytics consume an export.
- **Actual result:** A deterministic two-track fixture passed. An intentionally invalid fixture containing `face.landmarks.x` was correctly rejected. Production build and targeted ESLint passed.
- **Metric:** Validator pass/fail; valid fixture count `2`; invalid privacy fixture rejection confirmed.
- **Regression:** Existing runtime fields remain unchanged. No real-camera or exported browser telemetry was available, so live IndexedDB serialization remains unverified.
- **Next action:** Run the validator against an actual multi-face export, then begin Day 16 tracking-intelligence work only after schema validation passes on captured data.

## Day 16 — Temporal Face State

- **Date:** 2026-11-06
- **Feature:** Per-track temporal lifecycle state
- **Problem:** Track IDs and continuous movement metrics existed, but downstream consumers could not distinguish a newly observed, stable, moving, lost, or recovered face.
- **Change:** Added `TemporalFaceStateTracker` with `new`, `stable`, `moving`, `lost`, and `recovered` states. Three usable observations promote a track to `stable`; movement intensity at or above `0.25` marks it `moving`; a returning track emits `recovered` for its first usable observation after `lost`. Confidence-zero frames do not advance state.
- **Expected improvement:** Make track lifecycle and state transitions explicit without changing the existing ID assignment or occlusion policy.
- **Actual result:** The temporal state path was integrated into each unified signal and primary telemetry payload. Targeted ESLint, the updated two-track unified-signal validator fixture, production build, and `git diff --check` passed. No real-camera lifecycle sequence was available.
- **Metric:** `temporalState.state`, `previousState`, `transition`, and `observationCount` per tracked face frame.
- **Regression:** Existing track IDs, events, and recorder fields remain backward compatible. New/lost/recovered behavior requires manual validation with face entry, exit, and re-entry sequences.
- **Next action:** Validate state transitions against a labeled face entry/exit/recovery fixture, then proceed to Day 17 face centroid velocity.

## Day 17 — Face Velocity

- **Date:** 2026-11-07
- **Feature:** Per-track face-centroid velocity
- **Problem:** The tracker maintained centroid history for ID matching, but the unified signal did not expose how quickly a tracked face moved across the image.
- **Change:** Added `FaceVelocityTracker`, which converts consecutive centroid displacement into time-normalized pixels-per-second `vx`, `vy`, and scalar `speed`. The first valid sample reports zero velocity; confidence-zero frames report `null` and preserve the previous valid sample.
- **Expected improvement:** Make translational face movement measurable for later acceleration, motion classification, and tracking-quality analysis.
- **Actual result:** Face velocity was integrated into each unified signal and primary telemetry payload. Targeted ESLint, the updated unified-signal validator fixture, production build, and `git diff --check` passed. Expected deterministic values were checked (`vx=100`, `vy=50`, `speed=111.803...`) and confidence-zero output was checked as `null`. The optional TypeScript runtime fixture could not be transpiled because this checkout has no standalone `esbuild` binary. No real-camera motion sequence was available.
- **Metric:** `faceVelocity.vx`, `faceVelocity.vy`, and `faceVelocity.speed` in pixels per second.
- **Regression:** Existing tracker ID assignment and temporal state behavior remain unchanged. Resolution, frame timing, occlusion, and confidence behavior require manual validation with labeled motion sequences; the standalone runtime fixture remains pending until a transpiler is available.
- **Next action:** Validate velocity sign, magnitude, and null behavior on a controlled centroid fixture, then proceed to Day 18 head-pose velocity.

## Day 18 — Head Pose Velocity

- **Date:** 2026-11-08
- **Feature:** Per-track yaw, pitch, and roll velocity
- **Problem:** Smoothed head pose and aggregate movement intensity were available, but downstream consumers could not distinguish the angular direction and rate of yaw, pitch, and roll changes.
- **Change:** Added `HeadPoseVelocityTracker`, which converts consecutive smoothed pose deltas into degrees-per-second `yawVelocity`, `pitchVelocity`, and `rollVelocity`. The first valid observation reports zero; confidence-zero frames report `null` and preserve the previous valid pose sample.
- **Expected improvement:** Expose directional angular motion for future acceleration and slow/fast/sudden turn classification.
- **Actual result:** Head-pose velocity was integrated into each unified signal and primary telemetry payload. Targeted ESLint, the updated unified-signal validator fixture, production build, and `git diff --check` passed. Expected deterministic values (`yaw=100`, `pitch=-50`, `roll=25` degrees/second) and confidence-zero null behavior were checked. No real-camera pose sequence was available.
- **Metric:** `headPoseVelocity.yawVelocity`, `headPoseVelocity.pitchVelocity`, and `headPoseVelocity.rollVelocity` in degrees per second.
- **Regression:** Existing head movement intensity, centroid velocity, temporal state, and track IDs remain unchanged. Pose sign conventions and confidence behavior require manual validation with labeled rotation sequences.
- **Next action:** Validate angular velocity sign and magnitude on a controlled pose fixture, then proceed to Day 19 head-pose acceleration.

## Day 19 — Head Pose Acceleration

- **Date:** 2026-11-09
- **Feature:** Per-track yaw, pitch, and roll acceleration
- **Problem:** Head-pose velocity exposed angular direction and rate, but the system could not measure whether a turn was speeding up, slowing down, or changing abruptly.
- **Change:** Added `HeadPoseAccelerationTracker`, which converts consecutive yaw, pitch, and roll velocity samples into degrees-per-second-squared `yawAcceleration`, `pitchAcceleration`, and `rollAcceleration`. The first valid velocity sample reports zero; confidence-zero or null-velocity frames report `null` and do not advance history.
- **Expected improvement:** Provide a second-order motion signal for later slow, fast, and sudden-turn classification without labeling behavior prematurely.
- **Actual result:** Head-pose acceleration was integrated into each unified signal and primary telemetry payload. Targeted ESLint, validator fixture, production build, and `git diff --check` remain to be verified; no real-camera acceleration sequence was available.
- **Metric:** `headPoseAcceleration.yawAcceleration`, `headPoseAcceleration.pitchAcceleration`, and `headPoseAcceleration.rollAcceleration` in degrees per second squared.
- **Regression:** Existing pose velocity, centroid velocity, temporal state, and event behavior remain unchanged. Sampling jitter, sign conventions, and confidence gaps require manual validation with labeled rotation sequences.
- **Next action:** Validate acceleration sign, magnitude, and null behavior on a controlled velocity fixture, then proceed to Day 20 gaze stability.

## Day 20 — Gaze Stability

- **Date:** 2026-11-10
- **Feature:** Per-track committed gaze direction
- **Problem:** Gaze direction was classified independently on every frame, so pose values oscillating around a threshold could create one- or two-frame direction flips, noisy `GAZE_CHANGE` events, and unstable HUD/history values.
- **Change:** Added `GazeStabilityTracker`, which requires three consecutive identical gaze candidates before committing a new direction per track. The committed value now feeds motion events, unified signals, the live HUD, and 1Hz history; existing pose thresholds and `none` semantics remain unchanged.
- **Expected improvement:** Reduce transient gaze switches while preserving deliberate direction changes after a short confirmation window.
- **Actual result:** The deterministic tracker fixture passed; the production build, unified-signal validator, new tracker targeted lint, and `git diff --check` passed. The repository-wide TypeScript check and broad lint remain red on pre-existing strict-mode and formatting issues in legacy files. No real-camera or labeled gaze sequence was available, so live switch-rate improvement remains unmeasured.
- **Metric:** Raw candidate switch count versus committed gaze switch count; confirmation latency is three valid frames per track.
- **Regression:** Existing focus-score computation, pose thresholds, track IDs, event schema, and privacy boundary remain unchanged. Manual validation is required for rapid intentional gaze changes, face loss/recovery, and multi-face sessions.
- **Next action:** Capture a labeled threshold-oscillation and deliberate-gaze sequence, compare raw/committed switch rates, then proceed to Day 21 gaze transition episodes.

## Day 21 — Gaze Transition Episodes

- **Date:** 2026-11-11
- **Feature:** Duration-aware committed gaze transitions
- **Problem:** Stabilized gaze directions produced `GAZE_CHANGE` events, but the events did not indicate how long the previous gaze direction had persisted.
- **Change:** Extended the existing track-scoped gaze event state with `gazeStartedAt`. Every `GAZE_CHANGE` now includes `durationMs` for the preceding committed non-`none` gaze episode. Transitions through `none` close the episode timestamp without emitting a misleading directional change event.
- **Expected improvement:** Make gaze transitions temporally interpretable for focus episodes and downstream session analytics without changing event types or raw pose thresholds.
- **Actual result:** The deterministic event fixture passed with an 800 ms `center` episode, and it confirmed that a transition through `none` emits no misleading directional event. Targeted lint, production build, unified-signal validator, Prettier, and `git diff --check` also passed. No real-camera or labeled gaze sequence was available, so episode duration accuracy under detector gaps remains unmeasured.
- **Metric:** `GAZE_CHANGE.durationMs`, measured from committed gaze transition timestamps in milliseconds.
- **Regression:** Existing event fields, gaze stability behavior, track IDs, unified signal shape, and privacy boundary remain unchanged. Manual validation is required for rapid gaze changes, none transitions, face loss/recovery, and multi-face sessions.
- **Next action:** Compare emitted episode durations against labeled gaze intervals, then proceed to Day 22 focus episode aggregation.

## Day 22 — Focus Episode Aggregation

- **Date:** 2026-11-12
- **Feature:** Track-scoped committed-center focus episodes
- **Problem:** Focus score was available per frame and gaze transitions had durations, but there was no explicit state describing when a continuous on-screen focus episode started, how long it was active, or how long it lasted after closing.
- **Change:** Added `FocusEpisodeTracker`, which starts an episode when committed gaze becomes `center`, reports its current duration while active, and emits `completedDurationMs` when gaze leaves `center`. The frame is included in each unified signal and primary recorder payload; only scalar timestamps and durations are retained.
- **Expected improvement:** Make continuous attention intervals directly aggregatable for later session summaries without changing gaze thresholds or storing sensitive raw landmarks.
- **Actual result:** The deterministic fixture passed for active duration (`600 ms`), completed duration (`900 ms`), and missing-track reset behavior. Targeted lint, production build, unified-signal validator, Prettier, and whitespace checks also passed. No real-camera or labeled focus sequence was available, so duration accuracy and false episode rates remain unmeasured.
- **Metric:** `focusEpisode.active`, `startedAt`, `durationMs`, and `completedDurationMs` per track.
- **Regression:** Existing gaze direction, focus score, gaze events, track IDs, unified signal compatibility, and privacy boundary remain unchanged. Manual validation is required for face loss, detector gaps, rapid gaze changes, and multi-face sessions.
- **Next action:** Compare completed focus episode durations against labeled attention intervals, then proceed to Day 23 focus quality scoring.

## Day 23 — Focus Quality Scoring

- **Date:** 2026-11-13
- **Feature:** Confidence- and continuity-aware focus quality
- **Problem:** Pose-derived focus score described geometric alignment, but it did not expose whether the score was supported by detector confidence or a currently active committed-center episode.
- **Change:** Added `focusQualityFromSignals`, which computes a bounded `score = focusScore × confidenceWeight × continuity` and classifies it as `poor`, `fair`, or `good`. The result is included in each unified signal and the primary recorder payload; it does not store raw landmarks or frames.
- **Expected improvement:** Distinguish high geometric focus with weak evidence from a well-supported active focus signal, enabling safer downstream aggregation.
- **Actual result:** Deterministic score/band fixtures passed (`good=1.0`, `fair=0.56`, inactive episode=`poor/0`). Targeted lint, production build, unified-signal validator, Prettier, and whitespace checks also passed. No real-camera or labeled attention sequence was available, so calibration against human attention remains unmeasured.
- **Metric:** `focusQuality.score` in `[0, 1]` and `focusQuality.band` with thresholds `poor < 0.45`, `fair < 0.75`, `good >= 0.75`.
- **Regression:** Existing pose focus score, gaze stability, focus episodes, event fields, track IDs, and privacy boundary remain unchanged. Manual validation is required for low confidence, face loss, rapid gaze changes, and multi-face sessions.
- **Next action:** Compare focus quality against labeled confidence and attention intervals, then proceed to Day 24 focus quality aggregation.
