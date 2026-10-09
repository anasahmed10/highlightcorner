#!/usr/bin/env python3
"""Check the generated matchup URLs and lookup map before publishing."""

import argparse
import json
from pathlib import Path
import re
from xml.etree import ElementTree as ET

SITE = "https://highlightcorner.com/"
GAME_PAGE = re.compile(r"game-([0-9]+)\.html")
MAP_PREFIX = "window.HC_GAME_PAGES = "


def verify(output):
    output = Path(output)
    root = ET.parse(output / "sitemap.xml").getroot()
    namespace = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
    ids = []
    for item in root.findall(namespace + "url"):
        location = item.findtext(namespace + "loc", default="")
        if location == SITE + "game.html":
            raise RuntimeError("Generic game.html must not be in the sitemap")
        if location.startswith(SITE + "game-"):
            match = GAME_PAGE.fullmatch(location[len(SITE):])
            if not match:
                raise RuntimeError(f"Invalid matchup URL: {location}")
            ids.append(match.group(1))
    if not ids or len(ids) != len(set(ids)):
        raise RuntimeError("Sitemap matchup URLs are empty or duplicated")

    script = (output / "js/game-pages.js").read_text().strip()
    if not script.startswith(MAP_PREFIX) or not script.endswith(";"):
        raise RuntimeError("Missing or invalid game-page lookup script")
    lookup = json.loads(script[len(MAP_PREFIX):-1])
    if not isinstance(lookup, dict) or set(lookup) != set(ids):
        raise RuntimeError("Game-page lookup does not match sitemap URLs")

    pages = {match.group(1) for path in output.glob("game-*.html")
             if (match := GAME_PAGE.fullmatch(path.name))}
    if pages != set(ids):
        raise RuntimeError("Generated matchup files do not match sitemap URLs")
    for game_id in ids:
        season = lookup[game_id]
        if not isinstance(season, int):
            raise RuntimeError(f"Invalid season for game {game_id}")
        page = (output / f"game-{game_id}.html").read_text()
        expected = (
            f'<link rel="canonical" href="{SITE}game-{game_id}.html">',
            f'data-game-id="{game_id}"',
            f'data-season="{season}"',
            'src="js/game-pages.js"',
        )
        if any(fragment not in page for fragment in expected):
            raise RuntimeError(f"Incomplete generated matchup page: {game_id}")
    print(f"Verified {len(ids)} matchup pages, sitemap URLs and lookup entries")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("_site"))
    args = parser.parse_args()
    verify(args.out)
