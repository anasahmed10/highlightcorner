#!/usr/bin/env python3
"""Opt-in checks for the live ESPN and Sleeper response shapes used by the site.

Run for a completed regular-season week:
    python3 tools/check_provider_contracts.py --season 2026 --week 4
"""

import argparse
from http.client import HTTPException
import json
from math import isfinite
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
SUMMARY = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary"
SLEEPER = "https://api.sleeper.app/v1/stats/nfl/regular/{season}/{week}"
SCORING_KEYS = ("pts_ppr", "pts_half_ppr", "pts_std")


class SchemaError(ValueError):
    """A response no longer has a field or shape consumed by the site."""


class SampleUnavailable(ValueError):
    """The chosen week does not yet contain representative data."""


class FetchError(OSError):
    """A provider request failed before its response could be checked."""


def obj(value, path):
    if not isinstance(value, dict):
        raise SchemaError(f"{path}: expected object")
    return value


def array(value, path):
    if not isinstance(value, list):
        raise SchemaError(f"{path}: expected array")
    return value


def text(value, path):
    if not isinstance(value, str) or not value.strip():
        raise SchemaError(f"{path}: expected nonempty string")
    return value


def number(value, path):
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        raise SchemaError(f"{path}: expected number")
    try:
        result = float(value)
    except (ValueError, OverflowError) as error:
        raise SchemaError(f"{path}: expected number") from error
    if not isfinite(result):
        raise SchemaError(f"{path}: expected finite number")
    return result


def fetch_json(url):
    try:
        with urlopen(url, timeout=12) as response:
            try:
                return json.load(response)
            except (UnicodeError, json.JSONDecodeError) as error:
                raise SchemaError("response: invalid JSON") from error
    except HTTPError as error:
        raise FetchError(f"HTTP {error.code}") from error
    except (URLError, TimeoutError, OSError, HTTPException) as error:
        raise FetchError(type(error).__name__) from error


def competitors(value, path, *, completed):
    entries = array(value, path)
    if len(entries) != 2:
        raise SchemaError(f"{path}: expected two teams")
    sides = set()
    for index, entry in enumerate(entries):
        prefix = f"{path}[{index}]"
        team = obj(entry, prefix)
        side = team.get("homeAway")
        if side not in ("away", "home") or side in sides:
            raise SchemaError(f"{prefix}.homeAway: expected one away and one home")
        sides.add(side)
        info = obj(team.get("team"), f"{prefix}.team")
        text(info.get("abbreviation"), f"{prefix}.team.abbreviation")
        if completed:
            number(team.get("score"), f"{prefix}.score")


def status(value, path):
    kind = obj(obj(value, path).get("type"), f"{path}.type")
    if kind.get("state") not in ("pre", "in", "post"):
        raise SchemaError(f"{path}.type.state: expected pre, in, or post")
    if type(kind.get("completed")) is not bool:
        raise SchemaError(f"{path}.type.completed: expected boolean")
    detail = kind.get("shortDetail") or kind.get("detail")
    text(detail, f"{path}.type.shortDetail/detail")
    return kind["completed"]


def validate_scoreboard(data, season, week):
    board = obj(data, "scoreboard")
    actual_season = obj(board.get("season"), "season")
    if actual_season.get("year") != season or actual_season.get("type") != 2:
        raise SchemaError("season: expected requested regular-season year and type 2")
    if obj(board.get("week"), "week").get("number") != week:
        raise SchemaError("week.number: expected requested week")
    events = array(board.get("events"), "events")
    if not events:
        raise SampleUnavailable("events: no games for the selected week")
    final_id = None
    for index, value in enumerate(events):
        path = f"events[{index}]"
        event = obj(value, path)
        game_id = event.get("id")
        if isinstance(game_id, bool) or not str(game_id).isdigit():
            raise SchemaError(f"{path}.id: expected numeric game ID")
        text(event.get("date"), f"{path}.date")
        done = status(event.get("status"), f"{path}.status")
        games = array(event.get("competitions"), f"{path}.competitions")
        if not games:
            raise SchemaError(f"{path}.competitions: expected a game")
        competitors(obj(games[0], f"{path}.competitions[0]").get("competitors"),
                    f"{path}.competitions[0].competitors", completed=done)
        if done and final_id is None:
            final_id = str(game_id)
    return final_id


def validate_summary(data):
    summary = obj(data, "summary")
    header = obj(summary.get("header"), "header")
    games = array(header.get("competitions"), "header.competitions")
    if not games:
        raise SchemaError("header.competitions: expected a game")
    game = obj(games[0], "header.competitions[0]")
    done = status(header.get("status") or game.get("status"), "header.status/competition.status")
    text(game.get("date"), "header.competitions[0].date")
    competitors(game.get("competitors"), "header.competitions[0].competitors", completed=done)
    for field in ("scoringPlays", "winprobability", "injuries"):
        if summary.get(field) is not None:
            array(summary[field], field)
    for index, value in enumerate(summary.get("scoringPlays") or []):
        play = obj(value, f"scoringPlays[{index}]")
        for field in ("awayScore", "homeScore"):
            if play.get(field) is not None:
                number(play[field], f"scoringPlays[{index}].{field}")
        if play.get("period") is not None:
            number(obj(play["period"], f"scoringPlays[{index}].period").get("number"),
                   f"scoringPlays[{index}].period.number")
        if play.get("clock") is not None:
            clock = obj(play["clock"], f"scoringPlays[{index}].clock")
            if clock.get("value") is not None:
                number(clock["value"], f"scoringPlays[{index}].clock.value")
    for index, value in enumerate(summary.get("winprobability") or []):
        chance = obj(value, f"winprobability[{index}]")
        if chance.get("homeWinPercentage") is not None:
            number(chance["homeWinPercentage"], f"winprobability[{index}].homeWinPercentage")
    box = summary.get("boxscore")
    if box is not None:
        box = obj(box, "boxscore")
        for field in ("players", "teams"):
            if box.get(field) is not None:
                array(box[field], f"boxscore.{field}")
    for index, value in enumerate((box or {}).get("players") or []):
        group = obj(value, f"boxscore.players[{index}]")
        if group.get("statistics") is not None:
            array(group["statistics"], f"boxscore.players[{index}].statistics")
        for stat_index, stat in enumerate(group.get("statistics") or []):
            prefix = f"boxscore.players[{index}].statistics[{stat_index}]"
            stat = obj(stat, prefix)
            for field in ("keys", "labels", "athletes"):
                if stat.get(field) is not None:
                    array(stat[field], f"{prefix}.{field}")
            for athlete_index, athlete in enumerate(stat.get("athletes") or []):
                athlete_path = f"{prefix}.athletes[{athlete_index}]"
                person = obj(obj(athlete, athlete_path).get("athlete"), f"{athlete_path}.athlete")
                person_id = person.get("id")
                if isinstance(person_id, bool) or not str(person_id).isdigit():
                    raise SchemaError(f"{athlete_path}.athlete.id: expected numeric ID")
                text(person.get("displayName"), f"{athlete_path}.athlete.displayName")
    for index, value in enumerate((box or {}).get("teams") or []):
        team = obj(value, f"boxscore.teams[{index}]")
        if team.get("statistics") is not None:
            array(team["statistics"], f"boxscore.teams[{index}].statistics")
    for index, value in enumerate(summary.get("injuries") or []):
        team = obj(value, f"injuries[{index}]")
        if team.get("injuries") is not None:
            array(team["injuries"], f"injuries[{index}].injuries")


def validate_sleeper(data):
    stats = obj(data, "stats")
    if not stats:
        raise SampleUnavailable("stats: no player data for the selected week")
    for value in stats.values():
        if not isinstance(value, dict):
            continue  # The site skips malformed individual rows.
        if not all(key in value for key in SCORING_KEYS):
            continue
        for key in SCORING_KEYS:
            number(value[key], f"stats[sample].{key}")
        return
    raise SchemaError("stats: no player has all three scoring formats")


def run(season, week, fetch=fetch_json, output=print):
    results = []

    def check(label, url, validate):
        try:
            validate(fetch(url))
            results.append("PASS")
            output(f"PASS {label}")
            return True
        except FetchError as error:
            results.append("FETCH")
            output(f"FETCH {label}: {error}")
        except SchemaError as error:
            results.append("SCHEMA")
            output(f"SCHEMA {label}: {error}")
        except SampleUnavailable as error:
            results.append("UNAVAILABLE")
            output(f"UNAVAILABLE {label}: {error}")
        return False

    scoreboard_url = SCOREBOARD + "?" + urlencode({"dates": season, "seasontype": 2, "week": week})
    game = None

    def check_board(data):
        nonlocal game
        game = validate_scoreboard(data, season, week)

    if check("ESPN scoreboard", scoreboard_url, check_board):
        if game:
            check("ESPN game summary", SUMMARY + "?" + urlencode({"event": game}), validate_summary)
        else:
            results.append("UNAVAILABLE")
            output("UNAVAILABLE ESPN game summary: no completed game in selected week")
    else:
        output("SKIP ESPN game summary: scoreboard could not provide a game ID")
    check("Sleeper weekly stats", SLEEPER.format(season=season, week=week), validate_sleeper)
    output(f"Result: {results.count('PASS')} passed, {results.count('SCHEMA')} schema, "
           f"{results.count('FETCH')} fetch, {results.count('UNAVAILABLE')} unavailable")
    return 1 if "SCHEMA" in results else 2 if "FETCH" in results else 3 if "UNAVAILABLE" in results else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--season", type=int, required=True, help="regular-season year with completed games")
    parser.add_argument("--week", type=int, required=True, help="completed regular-season week (1–18)")
    args = parser.parse_args()
    if not 2020 <= args.season <= 2100 or not 1 <= args.week <= 18:
        parser.error("choose a regular-season year from 2020–2100 and week from 1–18")
    return run(args.season, args.week)


if __name__ == "__main__":
    sys.exit(main())
