#!/usr/bin/env python3
"""Build regular-season matchup pages and published recaps for the static site."""

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


def recap_paragraphs(recap):
    return ''.join(f'<p>{html.escape(paragraph)}</p>' for paragraph in recap['recap'].split('\n\n'))


def recap_article(recap, game, heading):
    label = html.escape(f'{game["away"]} at {game["home"]}')
    url = f'game-{game["id"]}.html'
    title = html.escape(recap['headline'])
    score = html.escape(f'{recap["away"]} {recap["awayScore"]} · {recap["home"]} {recap["homeScore"]}')
    verdict = html.escape(recap['verdict'])
    verdict_text = html.escape(recap['verdict'].replace('-', ' '))
    title_markup = f'<a href="{url}">{title}</a>' if heading == 'h3' else title
    return (f'<article class="recap-card" data-static-recap>'
            f'<p data-spoiler-placeholder hidden class="spoiler-notice">Recap hidden. Turn off Hide spoilers in Settings to read it. '
            f'<a href="{url}">{label} game center</a>.</p>'
            f'<div data-outcome><p class="page-sub">{score} · {game["season"]} Week {game["week"]}</p>'
            f'<span class="verdict {verdict}">{verdict_text}</span>'
            f'<{heading}>{title_markup}</{heading}>'
            f'{recap_paragraphs(recap)}'
            f'<div class="keystat"><strong>Key stat:</strong> {html.escape(recap["keyStat"])}</div>'
            f'</div></article>')


def load_recaps(output):
    recaps = json.loads((output / 'data/recaps.json').read_text())
    if not isinstance(recaps, list):
        raise RuntimeError('Recap archive must be an array')
    by_id = {}
    for recap in recaps:
        if not isinstance(recap, dict) or not GAME_ID.fullmatch(str(recap.get('gameId', ''))):
            raise RuntimeError('Recap has an invalid game ID')
        game_id = str(recap['gameId'])
        if game_id in by_id:
            raise RuntimeError(f'Duplicate recap game ID: {game_id}')
        if any(not isinstance(recap.get(field), str) or not recap[field].strip()
               for field in ('away', 'home', 'headline', 'recap', 'keyStat', 'verdict')):
            raise RuntimeError(f'Recap {game_id} is missing editorial text')
        if any(not isinstance(recap.get(field), int) or isinstance(recap[field], bool)
               for field in ('season', 'week', 'awayScore', 'homeScore')):
            raise RuntimeError(f'Recap {game_id} has invalid season, week, or scores')
        by_id[game_id] = recap
    return by_id


def render_recaps_index(template, recaps, games):
    weeks = sorted({(r['season'], r['week']) for r in recaps.values()}, reverse=True)
    ordered = [r for season, week in weeks for r in recaps.values()
               if (r['season'], r['week']) == (season, week)]
    entries = []
    last_week = None
    for recap in ordered:
        game = games[str(recap['gameId'])]
        this_week = (recap['season'], recap['week'])
        if this_week != last_week:
            entries.append(f'<h2 class="section-title">{recap["season"]} · Week {recap["week"]}</h2>')
            last_week = this_week
        entries.append(recap_article(recap, game, 'h3'))
    if not entries:
        return template
    lead = ''.join(entries[:2])
    rest = ''.join(entries[2:])
    template = replace_once(template, '<div id="recapsLead"><div class="loading"><div class="spinner"></div>Loading recaps…</div></div>',
                            f'<div id="recapsLead">{lead}</div>')
    return replace_once(template, '<div id="recapsRest"></div>', f'<div id="recapsRest">{rest}</div>')


def render_game(template, game, season, recap=None):
    title = (f'{game["away"]} at {game["home"]} — {season} Week {game["week"]} Recap | Highlight Corner'
             if recap else f'{game["away"]} at {game["home"]} — Highlight Corner')
    description = (f'{recap["headline"]} Read the original {season} Week {game["week"]} NFL game recap.'
                   if recap else f'{game["away"]} at {game["home"]}, Week {game["week"]} of the '
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
    if recap:
        page = replace_once(page, '<meta property="og:type" content="website">',
                            '<meta property="og:type" content="article">')
    page = replace_once(page, '<meta property="og:description" content="' + generic_description + '">',
                        f'<meta property="og:description" content="{html.escape(description, quote=True)}">')
    page = replace_once(page, '</head>', f'<link rel="canonical" href="{url}">\n</head>')
    placeholder = '<div id="game"><div class="loading"><div class="spinner"></div>Loading game…</div></div>'
    heading = html.escape(f'{game["away"]} at {game["home"]}')
    content = (recap_article(recap, game, 'h2') if recap else
               '<div class="loading"><div class="spinner"></div>Loading game…</div>')
    page = replace_once(page, placeholder,
                        f'<h1 class="page-title">{heading}</h1>'
                        f'<p class="page-sub">Week {game["week"]} · {season} NFL regular season</p>'
                        f'<div id="game" data-game-id="{game["id"]}" data-season="{season}" data-week="{game["week"]}">'
                        f'{content}</div>')
    return page


def build(output, seasons, weeks=range(1, 19)):
    output = Path(output)
    seasons = [seasons] if isinstance(seasons, int) else list(seasons)
    template = (output / 'game.html').read_text()
    recaps = load_recaps(output)
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
            if not data.get('season') or not data.get('week'):
                if season > 2026 and season == seasons[-1] and not data.get('events'):
                    continue  # Next season's schedule may not be published yet.
                raise RuntimeError('ESPN season/week metadata unavailable')
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
    for game_id, recap in recaps.items():
        game = games.get(game_id)
        if not game or (game['season'], game['week']) != (recap['season'], recap['week']):
            raise RuntimeError(f'Recap {game_id} has no matching published season/week game')

    for old in output.glob('game-*.html'):
        if re.fullmatch(r'game-[0-9]+\.html', old.name) and old.stem[5:] not in games:
            old.unlink()
    for game_id, game in sorted(games.items()):
        name = f'game-{game_id}.html'
        (output / name).write_text(render_game(template, game, game['season'], recaps.get(game_id)))
        url = ET.SubElement(root, namespace + 'url')
        ET.SubElement(url, namespace + 'loc').text = SITE + name
    (output / 'js/game-pages.js').write_text(
        'window.HC_GAME_PAGES = ' + json.dumps({game_id: games[game_id]['season'] for game_id in sorted(games)}, separators=(',', ':')) + ';\n')
    recap_index = output / 'recaps.html'
    recap_template = (Path(__file__).resolve().parents[1] / 'recaps.html').read_text()
    recap_index.write_text(render_recaps_index(recap_template, recaps, games))
    ET.indent(sitemap, space='  ')
    sitemap.write(sitemap_path, encoding='unicode', xml_declaration=True)
    print(f'Built {len(games)} game pages for {", ".join(map(str, seasons))}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=Path('_site'))
    parser.add_argument('--season', type=int, help='Build one season instead of the 2026-through-current archive')
    args = parser.parse_args()
    current = args.season or int(fetch_json(SCOREBOARD)['season']['year'])
    # Probe the next season too: ESPN can publish its schedule before its default
    # scoreboard context moves to that year. Empty unpublished weeks are skipped.
    build(args.out, args.season or range(2026, max(2026, current + 1) + 1))
