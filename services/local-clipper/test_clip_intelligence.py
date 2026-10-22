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
caption_quality = _load("caption_quality")
moment_score = _load("moment_score")


class CaptionQualityTests(unittest.TestCase):
    """Thresholds are pinned to the two films they were measured on."""

    # Shape of the real Omije track: markers and fragments, barely any speech.
    OMIJE = " ".join(
        f"[{i:02d}:00] [music] >> {'Hey.' if i % 2 else 'Okay.'} [music]" for i in range(0, 70)
    )
    # Shape of the real Hollow Vows track: continuous dialogue.
    HOLLOW = " ".join(
        f"[{i // 60:02d}:{i % 60:02d}] I told you this marriage was never going to survive the "
        f"things we buried together." for i in range(0, 140)
    )

    def test_rejects_the_yoruba_auto_caption_track(self):
        result = caption_quality.assess_captions(self.OMIJE, 4220)
        self.assertFalse(result["usable"])
        self.assertLess(result["words_per_minute"], caption_quality.MIN_WORDS_PER_MINUTE)

    def test_accepts_a_real_english_dialogue_track(self):
        result = caption_quality.assess_captions(self.HOLLOW, 8657)
        self.assertTrue(result["usable"], result["reason"])

    def test_music_markers_never_count_as_speech(self):
        result = caption_quality.assess_captions("[00:00] [music] [music] [music] [10:00] [music]", 1200)
        self.assertEqual(result["real_words"], 0)
        self.assertFalse(result["usable"])

    def test_empty_transcript_is_unusable(self):
        self.assertFalse(caption_quality.assess_captions("", 3600)["usable"])

    def test_rate_uses_the_span_the_timestamps_cover(self):
        # Truncated at the character cap: 2 minutes of dense speech out of a
        # 2-hour film must not be judged against the full runtime.
        dense = " ".join(f"[00:{i:02d}] the quick brown fox jumped over the lazy dog again" for i in range(0, 60))
        result = caption_quality.assess_captions(dense, 7200)
        self.assertLessEqual(result["covered_minutes"], 2.0)
        self.assertTrue(result["usable"], result["reason"])


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


class TranscriptTrustTests(unittest.TestCase):
    """A confident fabrication is worse than no transcript, so low confidence is dropped."""

    def test_rejects_the_yoruba_case_that_returned_gibberish(self):
        # Measured on a real Yoruba feature: 'yo' at 0.44 and 0.50.
        self.assertFalse(transcribe.is_transcript_trustworthy([("yo", 0.44), ("yo", 0.50)]))

    def test_accepts_confident_english(self):
        self.assertTrue(transcribe.is_transcript_trustworthy([("en", 0.97), ("en", 0.91)]))

    def test_judges_on_the_best_window_not_the_average(self):
        # A quiet window should not disqualify a clearly spoken one.
        self.assertTrue(transcribe.is_transcript_trustworthy([("en", 0.12), ("en", 0.88)]))

    def test_no_detections_is_not_trustworthy(self):
        self.assertFalse(transcribe.is_transcript_trustworthy([]))

    def test_threshold_is_adjustable(self):
        self.assertTrue(transcribe.is_transcript_trustworthy([("yo", 0.50)], min_confidence=0.4))


class MomentScoreTests(unittest.TestCase):
    """The language-independent scorer: loudness, dynamics, speech, music."""

    def test_parses_ffmpeg_rms_output(self):
        raw = ("frame:0 pts:0 pts_time:0\n"
               "lavfi.astats.Overall.RMS_level=-25.3\n"
               "frame:1 pts:160000 pts_time:10\n"
               "lavfi.astats.Overall.RMS_level=-18.6\n")
        self.assertEqual(moment_score.parse_rms_scan(raw), [(0.0, -25.3), (10.0, -18.6)])

    def test_silent_blocks_are_ranked_badly_not_dropped(self):
        raw = "pts_time:0\nRMS_level=-inf\npts_time:10\nRMS_level=-12.0\n"
        series = moment_score.parse_rms_scan(raw)
        self.assertEqual(len(series), 2)
        self.assertLess(series[0][1], -100)

    def _series(self, loud_at: float, total: float = 4000.0):
        series = []
        t = 0.0
        while t < total:
            quiet = -25.0
            loud = -6.0 if loud_at <= t < loud_at + 45 else quiet
            series.append((t, loud))
            t += 10.0
        return series

    def test_ranks_the_loud_stretch_first(self):
        ranked = moment_score.rank_moments(self._series(2000.0), duration=4000.0)
        self.assertTrue(ranked)
        self.assertLessEqual(abs(ranked[0]["start_time"] - 2000.0), 45.0)

    def test_stays_inside_the_allowed_window(self):
        ranked = moment_score.rank_moments(self._series(2000.0), duration=4000.0)
        for candidate in ranked:
            self.assertGreaterEqual(candidate["start_time"], 4000.0 * 0.15 - 1)
            self.assertLessEqual(candidate["end_time"], 4000.0 * 0.88 + 1)

    def test_music_markers_push_a_window_down(self):
        series = self._series(2000.0)
        clean = moment_score.rank_moments(series, duration=4000.0)
        noisy = moment_score.rank_moments(series, duration=4000.0,
                                          music_seconds=[2005.0, 2015.0, 2025.0])
        best_clean = next(c for c in clean if abs(c["start_time"] - 2000.0) < 5)
        best_noisy = next(c for c in noisy if abs(c["start_time"] - 2000.0) < 5)
        self.assertLess(best_noisy["score"], best_clean["score"])

    def test_drop_overlaps_spreads_picks_across_the_film(self):
        candidates = [{"start_time": float(t), "end_time": t + 45.0, "score": -t} for t in (100, 110, 120, 900)]
        kept = moment_score.drop_overlaps(candidates, min_gap=60.0)
        self.assertEqual([c["start_time"] for c in kept], [100.0, 900.0])

    def test_speech_demotes_a_loud_window_with_little_dialogue(self):
        # The real case: 41:43 was loudest but only 28% speech, a music sting.
        candidates = [
            {"start_time": 2503.0, "end_time": 2548.0, "score": 2.089},
            {"start_time": 3043.0, "end_time": 3088.0, "score": 1.695},
        ]
        fractions = {(2503.0, 2548.0): 0.281, (3043.0, 3088.0): 1.0}
        ranked = moment_score.apply_speech_scores(candidates, fractions)
        self.assertEqual(ranked[0]["start_time"], 3043.0)

    def test_missing_speech_data_leaves_a_candidate_untouched(self):
        candidates = [{"start_time": 10.0, "end_time": 55.0, "score": 1.0}]
        ranked = moment_score.apply_speech_scores(candidates, {})
        self.assertEqual(ranked[0]["score"], 1.0)
        self.assertNotIn("speech_fraction", ranked[0])

    def test_empty_series_ranks_nothing(self):
        self.assertEqual(moment_score.rank_moments([]), [])

    def test_reads_music_timestamps_out_of_a_caption_track(self):
        track = "[12:30] [music] something [13:00] hello there [14:00] [music]"
        self.assertEqual(moment_score.music_seconds_from_captions(track), [750.0, 840.0])


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
