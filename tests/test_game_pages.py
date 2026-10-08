import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tools import build_game_pages


def event(game_id="401872980", away="Tampa Bay Buccaneers", home="Dallas Cowboys"):
    return {
        "id": game_id,
        "date": "2026-10-09T00:15Z",
        "competitions": [{"competitors": [
            {"homeAway": "away", "team": {"id": "27", "displayName": away}},
            {"homeAway": "home", "team": {"id": "6", "displayName": home}},
        ]}],
    }


class GamePageTests(unittest.TestCase):
    def test_build_writes_matchup_html_index_and_matching_sitemap(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "js").mkdir()
            (root / "game.html").write_text(Path("game.html").read_text())
            (root / "sitemap.xml").write_text(Path("sitemap.xml").read_text())
            with patch.object(build_game_pages, "fetch_json", return_value={
                "season": {"year": 2026, "type": 2},
                "week": {"number": 5},
                "events": [event()],
            }):
                build_game_pages.build(root, 2026, weeks=[5])
            page = (root / "game-401872980.html").read_text()
            self.assertIn("Tampa Bay Buccaneers at Dallas Cowboys", page)
            self.assertIn('href="https://highlightcorner.com/game-401872980.html"', page)
            self.assertIn('content="https://highlightcorner.com/game-401872980.html"', page)
            self.assertIn('data-game-id="401872980"', page)
            self.assertIn('data-week="5"', page)
            self.assertIn('data-season="2026"', page)
            self.assertIn('"401872980"', (root / "js/game-pages.js").read_text())
            sitemap = (root / "sitemap.xml").read_text()
            self.assertIn("game-401872980.html", sitemap)
            self.assertNotIn("https://highlightcorner.com/game.html</loc>", sitemap)

    def test_invalid_games_are_not_published(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "js").mkdir()
            (root / "game.html").write_text(Path("game.html").read_text())
            (root / "sitemap.xml").write_text(Path("sitemap.xml").read_text())
            broken = event(game_id="bad")
            missing = event(game_id="401872981")
            missing["competitions"][0]["competitors"].pop()
            with patch.object(build_game_pages, "fetch_json", return_value={
                "season": {"year": 2026, "type": 2}, "week": {"number": 5},
                "events": [broken, missing],
            }):
                with self.assertRaisesRegex(RuntimeError, "no valid games"):
                    build_game_pages.build(root, 2026, weeks=[5])
            self.assertFalse((root / "game-bad.html").exists())
            self.assertFalse((root / "game-401872981.html").exists())
            self.assertNotIn("game-401872981", (root / "sitemap.xml").read_text())

    def test_provider_mismatch_aborts_before_publishing(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "js").mkdir()
            (root / "game.html").write_text(Path("game.html").read_text())
            (root / "sitemap.xml").write_text(Path("sitemap.xml").read_text())
            with patch.object(build_game_pages, "fetch_json", return_value={
                "season": {"year": 2025, "type": 2}, "week": {"number": 5},
                "events": [event()],
            }):
                with self.assertRaisesRegex(RuntimeError, "season/week"):
                    build_game_pages.build(root, 2026, weeks=[5])
            self.assertFalse((root / "game-401872980.html").exists())

    def test_rebuild_replaces_old_game_pages_without_duplicate_sitemap_urls(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "js").mkdir()
            (root / "game.html").write_text(Path("game.html").read_text())
            (root / "sitemap.xml").write_text(Path("sitemap.xml").read_text())
            payload = {"season": {"year": 2026, "type": 2}, "week": {"number": 5},
                       "events": [event()]}
            with patch.object(build_game_pages, "fetch_json", return_value=payload):
                build_game_pages.build(root, 2026, weeks=[5])
                build_game_pages.build(root, 2026, weeks=[5])
            self.assertEqual((root / "sitemap.xml").read_text().count(
                "https://highlightcorner.com/game-401872980.html"), 1)

    def test_archive_keeps_multiple_seasons(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "js").mkdir()
            (root / "game.html").write_text(Path("game.html").read_text())
            (root / "sitemap.xml").write_text(Path("sitemap.xml").read_text())
            def schedule(url):
                season = 2027 if 'dates=2027' in url else 2026
                game_id = '401999999' if season == 2027 else '401872980'
                return {"season": {"year": season, "type": 2},
                        "week": {"number": 5}, "events": [event(game_id=game_id)]}
            with patch.object(build_game_pages, "fetch_json", side_effect=schedule):
                build_game_pages.build(root, [2026, 2027], weeks=[5])
            self.assertTrue((root / "game-401872980.html").exists())
            self.assertTrue((root / "game-401999999.html").exists())
            index = (root / "js/game-pages.js").read_text()
            self.assertIn('"401872980":2026', index)
            self.assertIn('"401999999":2027', index)

    def test_unpublished_future_season_does_not_block_existing_archive(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "js").mkdir()
            (root / "game.html").write_text(Path("game.html").read_text())
            (root / "sitemap.xml").write_text(Path("sitemap.xml").read_text())
            def schedule(url):
                if 'dates=2027' in url:
                    return {"events": []}
                return {"season": {"year": 2026, "type": 2},
                        "week": {"number": 5}, "events": [event()]}
            with patch.object(build_game_pages, "fetch_json", side_effect=schedule):
                build_game_pages.build(root, [2026, 2027], weeks=[5])
            self.assertTrue((root / "game-401872980.html").exists())
            self.assertEqual((root / "js/game-pages.js").read_text().count('401872980'), 1)
