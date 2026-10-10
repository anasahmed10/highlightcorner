import tempfile
import unittest
import json
from pathlib import Path
from unittest.mock import patch

from tools import build_game_pages, verify_game_pages


def event(game_id="401872980", away="Tampa Bay Buccaneers", home="Dallas Cowboys"):
    return {
        "id": game_id,
        "date": "2026-10-09T00:15Z",
        "competitions": [{"competitors": [
            {"homeAway": "away", "team": {"id": "27", "displayName": away}},
            {"homeAway": "home", "team": {"id": "6", "displayName": home}},
        ]}],
    }


def stage(root, recaps=None):
    (root / "js").mkdir()
    (root / "data").mkdir()
    for name in ("game.html", "recaps.html", "sitemap.xml"):
        (root / name).write_text(Path(name).read_text())
    (root / "data/recaps.json").write_text(json.dumps(recaps or []))


class GamePageTests(unittest.TestCase):
    def test_future_schedule_builds_crawlable_matchup_and_sitemap_entry(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            stage(root)
            upcoming = event(game_id="401999001")
            upcoming["date"] = "2026-12-27T18:00Z"
            upcoming["status"] = {"type": {"state": "pre"}}
            payload = {"season": {"year": 2026, "type": 2}, "week": {"number": 17},
                       "events": [upcoming]}
            with patch.object(build_game_pages, "fetch_json", return_value=payload):
                build_game_pages.build(root, 2026, weeks=[17])
            page = (root / "game-401999001.html").read_text()
            self.assertIn("Tampa Bay Buccaneers at Dallas Cowboys", page)
            self.assertIn('data-week="17"', page)
            self.assertLess(page.index('<h1 class="page-title">'), page.index('<div id="game"'))
            self.assertNotIn('data-static-recap', page)
            self.assertIn('https://highlightcorner.com/game-401999001.html',
                          (root / "sitemap.xml").read_text())
            verify_game_pages.verify(root)

    def test_published_recap_is_in_game_html_and_crawlable_index(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            recap = {"gameId": "401872980", "season": 2026, "week": 5,
                     "away": "TB", "home": "DAL", "awayScore": 17, "homeScore": 20,
                     "headline": 'Late <script>alert("x")</script> comeback',
                     "recap": "First <b>paragraph</b>.\n\nSecond paragraph.",
                     "keyStat": "Three & out", "verdict": "nail-biter"}
            stage(root, [recap])
            payload = {"season": {"year": 2026, "type": 2}, "week": {"number": 5},
                       "events": [event()]}
            with patch.object(build_game_pages, "fetch_json", return_value=payload):
                build_game_pages.build(root, 2026, weeks=[5])
                build_game_pages.build(root, 2026, weeks=[5])
            page = (root / "game-401872980.html").read_text()
            index = (root / "recaps.html").read_text()
            self.assertIn("2026 Week 5 Recap", page)
            self.assertIn('content="article"', page)
            self.assertIn('data-static-recap', page)
            self.assertIn("TB 17 · DAL 20", page)
            self.assertIn("First &lt;b&gt;paragraph&lt;/b&gt;.", page)
            self.assertIn("Three &amp; out", page)
            self.assertNotIn('<script>alert("x")</script>', page)
            self.assertIn('href="game-401872980.html"', index)
            self.assertIn("Late &lt;script&gt;", index)
            verify_game_pages.verify(root)

    def test_recap_without_matching_scheduled_game_fails_publication(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            stage(root, [{"gameId": "999", "season": 2026, "week": 5,
                          "away": "TB", "home": "DAL", "awayScore": 17, "homeScore": 20,
                          "headline": "Headline", "recap": "Story", "keyStat": "Stat",
                          "verdict": "nail-biter"}])
            payload = {"season": {"year": 2026, "type": 2}, "week": {"number": 5},
                       "events": [event()]}
            with patch.object(build_game_pages, "fetch_json", return_value=payload):
                with self.assertRaisesRegex(RuntimeError, "no matching published"):
                    build_game_pages.build(root, 2026, weeks=[5])

    def test_build_writes_matchup_html_index_and_matching_sitemap(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            stage(root)
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
            verify_game_pages.verify(root)

            (root / "game-401872980.html").unlink()
            with self.assertRaisesRegex(RuntimeError, "files do not match"):
                verify_game_pages.verify(root)

    def test_invalid_games_are_not_published(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            stage(root)
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
            stage(root)
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
            stage(root)
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
            stage(root)
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
            stage(root)
            def schedule(url):
                if 'dates=2027' in url:
                    return {"events": []}
                return {"season": {"year": 2026, "type": 2},
                        "week": {"number": 5}, "events": [event()]}
            with patch.object(build_game_pages, "fetch_json", side_effect=schedule):
                build_game_pages.build(root, [2026, 2027], weeks=[5])
            self.assertTrue((root / "game-401872980.html").exists())
            self.assertEqual((root / "js/game-pages.js").read_text().count('401872980'), 1)

    def test_missing_archived_season_fails_the_build(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            stage(root)
            def schedule(url):
                if 'dates=2027' in url:
                    return {"events": []}
                season = 2028 if 'dates=2028' in url else 2026
                return {"season": {"year": season, "type": 2},
                        "week": {"number": 5}, "events": [event(game_id=str(401872980 + season - 2026))]}
            with patch.object(build_game_pages, "fetch_json", side_effect=schedule):
                with self.assertRaisesRegex(RuntimeError, 'metadata unavailable'):
                    build_game_pages.build(root, [2026, 2027, 2028], weeks=[5])
