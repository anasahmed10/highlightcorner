#!/usr/bin/env python3
"""Build crawler-visible 2026 regular-season matchup pages for the static site."""

import argparse
import html
import json
from pathlib import Path
import re
import urllib.parse
import urllib.request
from xml.etree import ElementTree as ET

SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
SITE = "https://highlightcorner.com/"
GAME_ID = re.compile(r"^[0-9]+$")


def fetch_json(url):
    request = urllib.request.Request(url, headers={"User-Agent": "HighlightCorner/1.0"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)


def game_from_event(event, week):
    game_id = str(event.get("id", ""))
    if not GAME_ID.fullmatch(game_id):
        return None
    competitors = ((event.get("competitions") or [{}])[0].get("competitors") or [])
    sides = {entry.get("homeAway"): entry.get("team") or {} for entry in competitors}
    if not all(sides.get(side, {}).get("id") and sides[side].get("displayName")
               for side in ("away", "home")):
        return None
    return {"id": game_id, "week": week,
            "away": sides["away"]["displayName"], "home": sides["home"]["displayName"]}


def replace_once(source, old, new):
    if source.count(old) != 1:
        raise RuntimeError(f"Game template expected exactly one {old!r}")
    return source.replace(old, new)


def render_game(template, game, season):
    title = f'{game["away"]} at {game["home"]} — Highlight Corner'
    description = (f'{game["away"]} at {game["home"]}, Week {game["week"]} of the '
                   f'{season} NFL regular season. Game center, official highlights and stats.')
    url = SITE + f'game-{game["id"]}.html'
    page = template
    page = replace_once(page, '<title>Highlight Corner — Game Center</title>',
                        f'<title>{html.escape(title)}</title>')
    generic_description = 'Box score, advanced stats, fantasy leaders, comedic recap and injuries for every NFL game.'
    page = replace_once(page, '<meta name="description" content="' + generic_description + '">',
                        f'<meta name="description" content="{html.escape(description, quote=True)}">')
    page = replace_once(page, '<meta name="robots" content="noindex,follow">', '')
    page = replace_once(page, '<meta property="og:title" content="Highlight Corner — Game Center">',
                        f'<meta property="og:title" content="{html.escape(title, quote=True)}">')
    page = replace_once(page, '<meta property="og:url" content="https://highlightcorner.com/game.html">',
                        f'<meta property="og:url" content="{url}">')
    page = replace_once(page, '<meta property="og:description" content="' + generic_description + '">',
                        f'<meta property="og:description" content="{html.escape(description, quote=True)}">')
    page = replace_once(page, '</head>', f'<link rel="canonical" href="{url}">\n</head>')
    placeholder = '<div id="game"><div class="loading"><div class="spinner"></div>Loading game…</div></div>'
    heading = html.escape(f'{game["away"]} at {game["home"]}')
    page = replace_once(page, placeholder,
                        f'<div id="game" data-game-id="{game["id"]}" data-season="{season}" data-week="{game["week"]}">'
                        f'<h1 class="page-title">{heading}</h1>'
                        f'<p class="page-sub">Week {game["week"]} · {season} NFL regular season</p>'
                        '<div class="loading"><div class="spinner"></div>Loading game…</div></div>')
    return page


def build(output, seasons, weeks=range(1, 19)):
    output = Path(output)
    seasons = [seasons] if isinstance(seasons, int) else list(seasons)
    template = (output / 'game.html').read_text()
    sitemap_path = output / 'sitemap.xml'
    sitemap = ET.parse(sitemap_path)
    namespace = '{http://www.sitemaps.org/schemas/sitemap/0.9}'
    root = sitemap.getroot()
    for item in list(root):
        location = item.find(namespace + 'loc')
        path = (location.text or '') if location is not None else ''
        if path.endswith('/game.html') or re.fullmatch(r'https://highlightcorner\.com/game-[0-9]+\.html', path):
            root.remove(item)

    games = {}
    for season in seasons:
        for week in weeks:
            params = urllib.parse.urlencode({'dates': season, 'seasontype': 2, 'week': week})
            data = fetch_json(SCOREBOARD + '?' + params)
            if (int(data['season']['year']), int(data['season']['type']), int(data['week']['number'])) != (season, 2, week):
                raise RuntimeError('ESPN season/week selection did not match the request')
            for event in data.get('events', []):
                game = game_from_event(event, week)
                if game:
                    game['season'] = season
                    if game['id'] in games and games[game['id']] != game:
                        raise RuntimeError('ESPN returned conflicting game IDs')
                    games[game['id']] = game
    if not games:
        raise RuntimeError('ESPN returned no valid games')

    for old in output.glob('game-*.html'):
        if re.fullmatch(r'game-[0-9]+\.html', old.name) and old.stem[5:] not in games:
            old.unlink()
    for game_id, game in sorted(games.items()):
        name = f'game-{game_id}.html'
        (output / name).write_text(render_game(template, game, game['season']))
        url = ET.SubElement(root, namespace + 'url')
        ET.SubElement(url, namespace + 'loc').text = SITE + name
    (output / 'js/game-pages.js').write_text(
        'window.HC_GAME_PAGES = ' + json.dumps({game_id: games[game_id]['season'] for game_id in sorted(games)}, separators=(',', ':')) + ';\n')
    ET.indent(sitemap, space='  ')
    sitemap.write(sitemap_path, encoding='unicode', xml_declaration=True)
    print(f'Built {len(games)} game pages for {", ".join(map(str, seasons))}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=Path('_site'))
    parser.add_argument('--season', type=int, help='Build one season instead of the 2026-through-current archive')
    args = parser.parse_args()
    current = args.season or int(fetch_json(SCOREBOARD)['season']['year'])
    build(args.out, args.season or range(2026, max(2026, current) + 1))
