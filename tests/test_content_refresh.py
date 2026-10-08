import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from prepare_recaps import game_fact, prepare, validate_recaps
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
                                                  "competitions": [{"competitors": [
                                                      {"homeAway": "away", "score": "17"},
                                                      {"homeAway": "home", "score": "20"}]}]},
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


if __name__ == "__main__":
    unittest.main()
