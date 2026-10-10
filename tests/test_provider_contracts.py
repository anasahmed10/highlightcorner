"""Offline checks for the opt-in live provider diagnostic."""

import copy
import io
import sys
import unittest
from pathlib import Path
from urllib.error import HTTPError
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from check_provider_contracts import (FetchError, SchemaError, fetch_json, run,
                                      validate_scoreboard, validate_sleeper, validate_summary)


def sample():
    competitors = [
        {"homeAway": "away", "team": {"abbreviation": "NE"}, "score": "17"},
        {"homeAway": "home", "team": {"abbreviation": "NYJ"}, "score": "20"},
    ]
    state = {"type": {"state": "post", "completed": True, "shortDetail": "Final"}}
    game = {"id": "123", "date": "2026-10-04T17:00:00Z", "status": state,
            "competitions": [{"competitors": copy.deepcopy(competitors)}]}
    board = {"season": {"year": 2026, "type": 2}, "week": {"number": 4}, "events": [game]}
    summary = {"header": {"status": state, "competitions": [{
        "date": game["date"], "competitors": copy.deepcopy(competitors)}]},
        "scoringPlays": [], "boxscore": {"players": [], "teams": []}}
    sleeper = {"1234": {"pts_ppr": 12.5, "pts_half_ppr": 11, "pts_std": 9.5}}
    return board, summary, sleeper


class ProviderContractTests(unittest.TestCase):
    def test_representative_responses_pass(self):
        board, summary, sleeper = sample()
        self.assertEqual(validate_scoreboard(board, 2026, 4), "123")
        validate_summary(summary)
        validate_sleeper(sleeper)

    def test_missing_scoreboard_and_optional_summary_shapes_identify_paths(self):
        board, summary, _ = sample()
        del board["events"][0]["competitions"][0]["competitors"][0]["team"]["abbreviation"]
        with self.assertRaisesRegex(SchemaError, r"events\[0\].*team\.abbreviation"):
            validate_scoreboard(board, 2026, 4)
        summary["boxscore"]["players"] = {"unexpected": "object"}
        with self.assertRaisesRegex(SchemaError, r"boxscore\.players: expected array"):
            validate_summary(summary)

    def test_sleeper_scoring_change_is_schema_drift(self):
        _, _, sleeper = sample()
        del sleeper["1234"]["pts_half_ppr"]
        with self.assertRaisesRegex(SchemaError, "all three scoring formats"):
            validate_sleeper(sleeper)

    def test_http_failure_is_fetch_failure_without_url_or_response_dump(self):
        with patch("check_provider_contracts.urlopen", side_effect=HTTPError(
            "https://example.test/private", 503, "Service unavailable", {}, None)):
            with self.assertRaisesRegex(FetchError, "^HTTP 503$"):
                fetch_json("https://example.test/private")

    def test_invalid_json_is_schema_failure(self):
        with patch("check_provider_contracts.urlopen", return_value=io.BytesIO(b"not json")):
            with self.assertRaisesRegex(SchemaError, "response: invalid JSON"):
                fetch_json("https://example.test/response")

    def test_runner_keeps_sleeper_check_after_espn_failure(self):
        _, _, sleeper = sample()
        output = []

        def fetch(url):
            if "espn.com" in url:
                raise FetchError("HTTP 503")
            return sleeper

        self.assertEqual(run(2026, 4, fetch=fetch, output=output.append), 2)
        self.assertEqual(output[0], "FETCH ESPN scoreboard: HTTP 503")
        self.assertEqual(output[1], "SKIP ESPN game summary: scoreboard could not provide a game ID")
        self.assertEqual(output[2], "PASS Sleeper weekly stats")

    def test_future_week_has_no_completed_summary_sample(self):
        board, _, sleeper = sample()
        board["events"][0]["status"]["type"].update(
            state="pre", completed=False, shortDetail="Sun 1:00 PM")
        for team in board["events"][0]["competitions"][0]["competitors"]:
            del team["score"]
        output = []

        def fetch(url):
            return sleeper if "sleeper.app" in url else board

        self.assertEqual(run(2026, 4, fetch=fetch, output=output.append), 3)
        self.assertIn("UNAVAILABLE ESPN game summary: no completed game", output[1])


if __name__ == "__main__":
    unittest.main()
