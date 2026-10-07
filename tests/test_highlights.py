import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("refresh_highlights", Path(__file__).parents[1] / "tools/refresh_highlights.py")
mapper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mapper)


def game(game_id="game-4", week=4, season=2026):
    return {"id": game_id, "week": week, "season": season, "date": "2026-10-04T17:00:00Z",
            "away": {"displayName": "Philadelphia Eagles", "shortDisplayName": "Eagles", "abbreviation": "PHI"},
            "home": {"displayName": "Tampa Bay Buccaneers", "shortDisplayName": "Buccaneers", "abbreviation": "TB"}}


TITLE = "Philadelphia Eagles vs. Tampa Bay Buccaneers Game Highlights | NFL 2026 Season Week 4"


class MatchTests(unittest.TestCase):
    def test_rematches_and_previous_seasons_are_not_confused(self):
        games = [game(), game("game-8", 8), game("old", 4, 2025)]
        self.assertEqual(mapper.match_title(TITLE, games)["id"], "game-4")
        self.assertEqual(mapper.match_title(TITLE.replace("Week 4", "Week 8"), games)["id"], "game-8")
        self.assertEqual(mapper.match_title(TITLE.replace("2026", "2025"), games)["id"], "old")

    def test_swapped_sides_and_alternative_season_title_match(self):
        title = "Tampa Bay Buccaneers vs Philadelphia Eagles Full Game Highlights | 2026 NFL Season Week 4"
        self.assertEqual(mapper.match_title(title, [game()])["id"], "game-4")

    def test_live_official_title_variants_match(self):
        prefix = "Philadelphia Eagles vs Tampa Bay Buccaneers Game Highlights"
        for suffix in [" | NFL 2026 Week 4", " | 2026 NFL Week 4",
                       " | 2026 Week 4 Melbourne Game", " Week 4 | NFL 2026",
                       " from Rio | 2026 NFL Season Week 4"]:
            self.assertEqual(mapper.match_title(prefix + suffix, [game()])["id"], "game-4")
        for suffix in [" | NFL 2026", " Week 3 | NFL 2026 Week 4"]:
            self.assertIsNone(mapper.match_title(prefix + suffix, [game()]))

    def test_previews_player_clips_full_replays_and_ambiguous_games_are_rejected(self):
        for title in [TITLE.replace("Game Highlights", "Game Preview"),
                      TITLE.replace("Game Highlights", "FULL GAME"),
                      "Saquon Barkley Game Highlights | NFL 2026 Season Week 4",
                      TITLE.replace("2026", "2024")]:
            self.assertIsNone(mapper.match_title(title, [game()]), title)
        self.assertIsNone(mapper.match_title(TITLE, [game(), game("duplicate")]))

    def test_actual_video_owner_and_visibility_are_checked(self):
        for channel, privacy, expected in [(mapper.NFL_CHANNEL, "public", True),
                                           ("imposter", "public", False),
                                           (mapper.NFL_CHANNEL, "private", False)]:
            def api(resource, key, **params):
                if resource == "channels":
                    return {"items": [{"id": mapper.NFL_CHANNEL, "contentDetails": {"relatedPlaylists": {"uploads": "uploads"}}}]}
                if resource == "playlistItems":
                    return {"items": [{"snippet": {"title": TITLE}, "contentDetails": {"videoId": "Abcdef12345", "videoPublishedAt": "2026-10-05T01:00:00Z"}}]}
                return {"items": [{"id": "Abcdef12345", "snippet": {"title": TITLE, "channelId": channel}, "status": {"privacyStatus": privacy}}]}
            with patch.object(mapper, "youtube", api):
                result = mapper.discover("fake-key", [game()])
            self.assertEqual(bool(result), expected)
            if result:
                self.assertEqual(result["game-4"]["url"], "https://www.youtube.com/watch?v=Abcdef12345")
                self.assertNotIn("fake-key", str(result))

    def test_removed_or_renamed_videos_are_not_published(self):
        def api(resource, key, **params):
            if resource == "channels":
                return {"items": [{"id": mapper.NFL_CHANNEL, "contentDetails": {"relatedPlaylists": {"uploads": "uploads"}}}]}
            if resource == "playlistItems":
                return {"items": [{"snippet": {"title": TITLE}, "contentDetails": {"videoId": "Abcdef12345"}}]}
            return {"items": [{"id": "Abcdef12345", "snippet": {"title": TITLE.replace("Week 4", "Week 3"), "channelId": mapper.NFL_CHANNEL}, "status": {"privacyStatus": "public"}}]}
        with patch.object(mapper, "youtube", api):
            self.assertEqual(mapper.discover("fake-key", [game()]), {})


if __name__ == "__main__":
    unittest.main()
