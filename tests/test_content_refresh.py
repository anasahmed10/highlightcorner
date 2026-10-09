import sys
import copy
import subprocess
import tempfile
import json
from unittest.mock import patch
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from prepare_recaps import game_fact, prepare, validate_recaps, main
from refresh_players import build_map


class ContentRefreshTests(unittest.TestCase):
    def test_player_map_keeps_historical_ids_and_updates_active_players(self):
        source = {str(i): {"active": True, "position": "QB", "full_name": f"Player {i}", "team": "NE"}
                  for i in range(100, 201)}
        existing = {"1": {"n": "Former Player", "p": "QB", "t": "NYJ"},
                    "NE": {"n": "New England Patriots", "p": "DEF", "t": "NE"}}
        result, count = build_map(source, existing)
        self.assertEqual(count, 101)
        self.assertIn("1", result)
        self.assertIn("NE", result)
        self.assertEqual(result["100"], {"n": "Player 100", "p": "QB", "t": "NE"})

    def test_preparation_flags_incomplete_and_delayed_games(self):
        event = {"id": "123", "date": "2026-10-04T17:00:00Z", "status": {"type": {"completed": True}},
                 "competitions": [{"competitors": [
                     {"homeAway": "away", "score": "17", "team": {"abbreviation": "NE"}},
                     {"homeAway": "home", "score": "20", "team": {"abbreviation": "NYJ"}}]}]}
        board = {"season": {"year": 2026, "type": 2}, "week": {"number": 5},
                 "events": [event, {**event, "id": "124", "status": {"type": {"completed": False}}}]}
        ready, flagged = prepare(board, {"123": {"header": {"id": "123", "season": {"year": 2026, "type": 2}, "week": 5,
                                                  "status": {"type": {"completed": True}},
                                                  "competitions": [{"competitors": [
                                                      {"homeAway": "away", "score": "17", "team": {"abbreviation": "NE"}},
                                                      {"homeAway": "home", "score": "20", "team": {"abbreviation": "NYJ"}}]}]},
                                                  "scoringPlays": []}}, 2026, 5)
        self.assertEqual(len(ready), 1)
        self.assertEqual(len(flagged), 1)
        self.assertEqual(ready[0]["awayScore"], 17)
        ready, flagged = prepare(board, {}, 2026, 5)
        self.assertEqual(len(ready), 0)
        self.assertEqual(len(flagged), 2)

    def test_recaps_validate_season_week_verdict_and_provider_scores(self):
        game = {"away": "NE", "home": "NYJ", "awayScore": 17, "homeScore": 20}
        recap = {"season": 2026, "week": 5, "gameId": "123", "away": "NE", "home": "NYJ",
                 "awayScore": 17, "homeScore": 20, "verdict": "nail-biter", "headline": "Headline",
                 "recap": "Editorial copy", "keyStat": "Verified stat"}
        self.assertEqual(validate_recaps([recap], 2026, 5, {"123": game}), [])
        errors = validate_recaps([{**recap, "homeScore": 21, "verdict": "guess"}], 2026, 5, {"123": game})
        self.assertTrue(any("verdict" in error for error in errors))
        self.assertTrue(any("score" in error for error in errors))
        with self.assertRaises(ValueError):
            prepare({"season": {"year": 2025, "type": 2}, "week": {"number": 5}}, {}, 2026, 5)

    def final_week(self):
        competitors = [{"homeAway": "away", "score": "17", "team": {"abbreviation": "NE"}},
                       {"homeAway": "home", "score": "20", "team": {"abbreviation": "NYJ"}}]
        status = {"type": {"completed": True}}
        event = {"id": "123", "status": status, "competitions": [{"competitors": competitors}]}
        board = {"season": {"year": 2026, "type": 2}, "week": {"number": 5}, "events": [event]}
        summary = {"header": {"id": "123", "season": {"year": 2026, "type": 2}, "week": 5,
                              "competitions": [{"competitors": copy.deepcopy(competitors), "status": status}]}}
        return board, summary

    def test_preparation_rejects_wrong_summary_teams_even_when_scores_match(self):
        board, summary = self.final_week()
        summary["header"]["competitions"][0]["competitors"][0]["team"]["abbreviation"] = "DAL"
        ready, flagged = prepare(board, {"123": summary}, 2026, 5)
        self.assertEqual(ready, [])
        self.assertIn("matchup differs", flagged[0]["reason"])

    def test_preparation_flags_stale_nonfinal_summary_and_accepts_competition_status(self):
        board, summary = self.final_week()
        ready, flagged = prepare(board, {"123": summary}, 2026, 5)
        self.assertEqual(len(ready), 1)
        self.assertEqual(flagged, [])
        self.assertTrue(ready[0]["summaryUrl"].endswith("event=123"))
        summary["header"]["competitions"][0]["status"] = {"type": {"completed": False}}
        ready, flagged = prepare(board, {"123": summary}, 2026, 5)
        self.assertEqual(ready, [])
        self.assertEqual(flagged[0]["reason"], "Summary is not final")

    def test_malformed_summary_and_event_are_flagged_without_losing_other_games(self):
        board, summary = self.final_week()
        board["events"].append(None)
        ready, flagged = prepare(board, {"123": summary}, 2026, 5)
        self.assertEqual(len(ready), 1)
        self.assertEqual(len(flagged), 1)
        summary["header"]["competitions"][0]["competitors"][0]["team"] = None
        ready, flagged = prepare(board, {"123": summary}, 2026, 5)
        self.assertEqual(ready, [])
        self.assertEqual(len(flagged), 2)

    def test_command_writes_evidence_and_flags_malformed_events_without_editing_recaps(self):
        board, summary = self.final_week()
        board["events"].append(None)
        with tempfile.TemporaryDirectory() as directory:
            archive, output = Path(directory) / "recaps.json", Path(directory) / "evidence.json"
            archive.write_text("[]")
            with patch("prepare_recaps.fetch", side_effect=[board, summary]), patch.object(sys, "argv", [
                "prepare_recaps.py", "--season", "2026", "--week", "5", "--recaps", str(archive), "--out", str(output)
            ]):
                main()
            evidence = json.loads(output.read_text())
            self.assertEqual(len(evidence["ready"]), 1)
            self.assertEqual(len(evidence["flagged"]), 1)
            self.assertIn("fetchedAt", evidence)
            self.assertEqual(archive.read_text(), "[]")

    def test_recaps_reject_duplicate_game_ids_across_weeks_and_malformed_fields(self):
        recap = {"season": 2026, "week": 4, "gameId": "123", "away": "NE", "home": "NYJ",
                 "awayScore": 17, "homeScore": 20, "verdict": "nail-biter", "headline": "Headline",
                 "recap": "Editorial copy", "keyStat": "Verified stat"}
        errors = validate_recaps([recap, {**recap, "week": 3}], 2026, 5, {})
        self.assertTrue(any("duplicate ESPN game ID" in error for error in errors))
        errors = validate_recaps([{**recap, "season": [], "verdict": []}], 2026, 5, {})
        self.assertTrue(any("invalid season" in error for error in errors))
        self.assertTrue(any("unsupported verdict" in error for error in errors))

    def test_player_refresh_rejects_invalid_preserved_values_and_small_upstream_response(self):
        source = {str(i): {"active": True, "position": "QB", "full_name": f"Player {i}", "team": "NE"}
                  for i in range(100, 201)}
        for invalid in [{"n": "", "p": "QB", "t": "NE"}, {"n": "Name", "p": "XYZ", "t": "NE"},
                        {"n": "Name", "p": "QB", "t": "FA"}, {"n": "Name", "p": [], "t": "NE"}]:
            existing = {"1": invalid}
            saved = copy.deepcopy(existing)
            with self.assertRaises(ValueError):
                build_map(source, existing)
            self.assertEqual(existing, saved)
        with self.assertRaises(ValueError):
            build_map({}, {})

    def test_supporting_output_cannot_overwrite_the_input_or_production_archive(self):
        root = Path(__file__).resolve().parents[1]
        script = root / "tools/prepare_recaps.py"
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / "recaps.json"
            archive.write_text("[]")
            for output in [archive, root / "data/recaps.json"]:
                before = output.read_bytes()
                result = subprocess.run([sys.executable, str(script), "--season", "2026", "--week", "5",
                                         "--recaps", str(archive), "--out", str(output)], capture_output=True, text=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("cannot overwrite", result.stderr)
                self.assertEqual(output.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
