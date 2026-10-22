"""Tests for the clip-selection helpers.

Only the decision logic is covered here — window planning and cut snapping —
so the suite runs without a network, a video file or Whisper weights.
"""

import importlib.util
import unittest
from pathlib import Path


def _load(name: str):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(f"{name}.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


transcribe = _load("transcribe")
scene_snap = _load("scene_snap")


class TranscriptionWindowTests(unittest.TestCase):
    def test_prefers_the_strongest_replay_peaks(self):
        peaks = [
            {"start_time": 300, "end_time": 330, "intensity": 0.2},
            {"start_time": 2400, "end_time": 2430, "intensity": 0.9},
        ]
        windows = transcribe.plan_transcription_windows(
            3600, heatmap_peaks=peaks, window_seconds=90, max_total_seconds=90
        )
        self.assertEqual(len(windows), 1)
        start, end = windows[0]
        # The 0.9-intensity peak at 2400s must win the single available slot.
        self.assertLessEqual(start, 2415)
        self.assertGreaterEqual(end, 2415)

    def test_never_exceeds_the_time_budget(self):
        peaks = [{"start_time": 600 + i * 400, "end_time": 630 + i * 400, "intensity": 0.5} for i in range(10)]
        windows = transcribe.plan_transcription_windows(
            6000, heatmap_peaks=peaks, window_seconds=90, max_total_seconds=180
        )
        self.assertLessEqual(sum(end - start for start, end in windows), 180.0 + 1e-6)

    def test_skips_opening_logos_and_closing_credits_on_a_feature(self):
        windows = transcribe.plan_transcription_windows(7200, heatmap_peaks=[], window_seconds=90)
        self.assertTrue(windows)
        for start, end in windows:
            self.assertGreaterEqual(start, 7200 * 0.15 - 1)
            self.assertLessEqual(end, 7200 * 0.88 + 1)

    def test_samples_the_film_when_there_is_no_heatmap(self):
        windows = transcribe.plan_transcription_windows(
            3600, heatmap_peaks=None, window_seconds=60, max_total_seconds=300
        )
        self.assertGreater(len(windows), 1)

    def test_short_video_is_not_trimmed_to_nothing(self):
        windows = transcribe.plan_transcription_windows(120, heatmap_peaks=[], window_seconds=90)
        self.assertTrue(windows)

    def test_overlapping_peaks_are_not_transcribed_twice(self):
        peaks = [
            {"start_time": 1000, "end_time": 1030, "intensity": 0.9},
            {"start_time": 1010, "end_time": 1040, "intensity": 0.8},
        ]
        windows = transcribe.plan_transcription_windows(
            3600, heatmap_peaks=peaks, window_seconds=90, max_total_seconds=600
        )
        self.assertEqual(len(windows), 1)

    def test_zero_duration_plans_nothing(self):
        self.assertEqual(transcribe.plan_transcription_windows(0), [])

    def test_timestamps_match_the_caption_format(self):
        self.assertEqual(transcribe.format_timestamp(0), "00:00")
        self.assertEqual(transcribe.format_timestamp(95), "01:35")
        self.assertEqual(transcribe.format_timestamp(3725), "01:02:05")


class SceneSnapTests(unittest.TestCase):
    def test_picks_the_closest_cut(self):
        self.assertEqual(scene_snap.nearest_cut(100.0, [96.0, 101.0, 140.0], max_shift=2.5), 101.0)

    def test_ignores_cuts_that_are_too_far(self):
        self.assertIsNone(scene_snap.nearest_cut(100.0, [80.0, 130.0], max_shift=2.5))

    def test_snaps_both_ends_onto_cuts(self):
        start, end, report = scene_snap.snap_range(100.0, 145.0, [99.2, 120.0, 144.1], max_shift=2.5)
        self.assertAlmostEqual(start, 99.2)
        self.assertAlmostEqual(end, 144.1)
        self.assertTrue(report["snapped_start"])
        self.assertTrue(report["snapped_end"])

    def test_keeps_the_range_when_no_cut_is_near(self):
        start, end, report = scene_snap.snap_range(100.0, 145.0, [10.0, 300.0], max_shift=2.5)
        self.assertEqual((start, end), (100.0, 145.0))
        self.assertFalse(report["snapped_start"])
        self.assertFalse(report["snapped_end"])

    def test_never_collapses_a_clip_below_the_minimum(self):
        # A cut just after the start would leave almost no clip, so it is refused.
        start, end, _ = scene_snap.snap_range(100.0, 106.0, [105.9], max_shift=2.5, min_duration=5.0)
        self.assertGreaterEqual(end - start, 5.0)

    def test_no_cuts_reports_why(self):
        _start, _end, report = scene_snap.snap_range(10.0, 40.0, [], max_shift=2.5)
        self.assertEqual(report["reason"], "no_cuts_in_range")

    def test_merge_windows_collapses_touching_ranges(self):
        merged = transcribe.merge_windows([(0.0, 10.0), (10.5, 20.0), (40.0, 50.0)])
        self.assertEqual(merged, [(0.0, 20.0), (40.0, 50.0)])


if __name__ == "__main__":
    unittest.main()
