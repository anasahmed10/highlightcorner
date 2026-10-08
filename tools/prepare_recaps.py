#!/usr/bin/env python3
"""Prepare sourced NFL game facts and validate editorial recaps; never writes recaps.json.

Run: python3 tools/prepare_recaps.py --season 2026 --week 5 --out /tmp/hc-week5.json
"""
import argparse
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
SUMMARY = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary"
VERDICTS = {"nail-biter", "comfortable", "garbage-time", "blowout"}


def fetch(url):
    with urlopen(url, timeout=15) as response:
        return json.load(response)


def validate_recaps(recaps, season, week, games):
    if not isinstance(recaps, list):
        raise ValueError("Recaps must be a JSON array")
    seen = set()
    errors = []
    for index, recap in enumerate(recaps):
        if not isinstance(recap, dict):
            errors.append(f"entry {index}: expected an object")
            continue
        key = (recap.get("season"), recap.get("week"), str(recap.get("gameId")))
        if key in seen:
            errors.append(f"entry {index}: duplicate season/week/game ID")
        seen.add(key)
        if type(recap.get("season")) is not int or recap["season"] < 2020:
            errors.append(f"entry {index}: invalid season")
        if type(recap.get("week")) is not int or not 1 <= recap["week"] <= 18:
            errors.append(f"entry {index}: invalid regular-season week")
        if not isinstance(recap.get("gameId"), str) or not recap["gameId"].isdigit():
            errors.append(f"entry {index}: invalid ESPN game ID")
        if recap.get("verdict") not in VERDICTS:
            errors.append(f"entry {index}: unsupported verdict")
        for field in ("awayScore", "homeScore"):
            if type(recap.get(field)) is not int or recap[field] < 0:
                errors.append(f"entry {index}: invalid {field}")
        for field in ("away", "home", "headline", "recap", "keyStat"):
            if not isinstance(recap.get(field), str) or not recap[field].strip():
                errors.append(f"entry {index}: missing {field}")
        if (recap.get("season"), recap.get("week")) != (season, week):
            continue  # Other weeks are retained and checked structurally, not against this scoreboard.
        game = games.get(str(recap.get("gameId")))
        if game is None:
            errors.append(f"entry {index}: game ID not found among completed ESPN games")
        elif any(recap.get(field) != game[field] for field in ("away", "home", "awayScore", "homeScore")):
            errors.append(f"entry {index}: matchup or final score differs from ESPN")
    return errors


def game_fact(event):
    if not str(event.get("id", "")).isdigit():
        raise ValueError("ESPN game has an invalid ID")
    competitors = event.get("competitions", [{}])[0].get("competitors", [])
    teams = {team.get("homeAway"): team for team in competitors}
    if set(teams) != {"away", "home"}:
        raise ValueError(f"ESPN game {event['id']} has incomplete competitors")
    fact = {"gameId": str(event["id"]), "kickoff": event.get("date"),
            "source": f"https://www.espn.com/nfl/game/_/gameId/{event['id']}"}
    for side in ("away", "home"):
        team = teams[side]
        abbr = team.get("team", {}).get("abbreviation")
        score = team.get("score")
        if not isinstance(abbr, str) or not abbr or not str(score).isdigit():
            raise ValueError(f"ESPN game {event['id']} has incomplete {side} result")
        fact[side] = abbr
        fact[side + "Score"] = int(score)
    return fact


def prepare(scoreboard, summaries, season, week):
    if (scoreboard.get("season", {}).get("year"), scoreboard.get("season", {}).get("type"),
            scoreboard.get("week", {}).get("number")) != (season, 2, week):
        raise ValueError("ESPN returned a different season, type, or week")
    if not scoreboard.get("events"):
        raise ValueError("ESPN returned no games for this regular-season week")
    ready, flagged = [], []
    for event in scoreboard.get("events", []):
        game_id = str(event.get("id", ""))
        if not event.get("status", {}).get("type", {}).get("completed"):
            flagged.append({"gameId": game_id, "reason": "Game is not final"})
            continue
        try:
            fact = game_fact(event)
            summary = summaries.get(game_id)
            if not isinstance(summary, dict):
                raise ValueError("Summary is unavailable")
            header = summary.get("header", {})
            if (str(header.get("id")) != game_id or header.get("season", {}).get("year") != season or
                    header.get("season", {}).get("type") != 2 or header.get("week") != week):
                raise ValueError("Summary ID or season/week does not match")
            summary_teams = {team.get("homeAway"): team for team in
                             header.get("competitions", [{}])[0].get("competitors", [])}
            for side in ("away", "home"):
                if str(summary_teams.get(side, {}).get("score")) != str(fact[side + "Score"]):
                    raise ValueError("Summary final score differs from scoreboard")
            fact["scoringPlays"] = [
                {"period": play.get("period", {}).get("number"), "clock": play.get("clock", {}).get("displayValue"),
                 "text": play.get("text"), "awayScore": play.get("awayScore"), "homeScore": play.get("homeScore")}
                for play in summary.get("scoringPlays", [])]
            ready.append(fact)
        except (ValueError, KeyError, IndexError, TypeError) as error:
            flagged.append({"gameId": game_id, "reason": str(error)})
    return ready, flagged


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--season", type=int, required=True)
    parser.add_argument("--week", type=int, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--recaps", type=Path, default=Path("data/recaps.json"))
    args = parser.parse_args()
    if not 2020 <= args.season <= 2100 or not 1 <= args.week <= 18:
        parser.error("Only regular-season years 2020–2100 and weeks 1–18 are supported")
    scoreboard_url = SCOREBOARD + "?" + urlencode({"dates": args.season, "seasontype": 2, "week": args.week})
    scoreboard = fetch(scoreboard_url)
    if (scoreboard.get("season", {}).get("year"), scoreboard.get("season", {}).get("type"),
            scoreboard.get("week", {}).get("number")) != (args.season, 2, args.week):
        raise SystemExit("ESPN did not return the requested regular-season week")
    summaries = {}
    for event in scoreboard.get("events", []):
        if event.get("status", {}).get("type", {}).get("completed") and str(event.get("id", "")).isdigit():
            try:
                summaries[str(event["id"])] = fetch(SUMMARY + "?" + urlencode({"event": event["id"]}))
            except (OSError, ValueError):
                pass  # Flag delayed/unavailable summaries instead of inventing supporting facts.
    ready, flagged = prepare(scoreboard, summaries, args.season, args.week)
    recaps = json.loads(args.recaps.read_text())
    final_games = {}
    for event in scoreboard.get("events", []):
        if event.get("status", {}).get("type", {}).get("completed"):
            try:
                game = game_fact(event)
                final_games[game["gameId"]] = game
            except (ValueError, KeyError, IndexError, TypeError):
                pass
    errors = validate_recaps(recaps, args.season, args.week, final_games)
    if errors:
        raise SystemExit("Recap validation failed:\n" + "\n".join(errors))
    output = {"season": args.season, "week": args.week, "source": "ESPN NFL scoreboard and game summaries",
              "scoreboardUrl": scoreboard_url, "ready": ready, "flagged": flagged,
              "editorialNote": "Supporting facts only. Verify key stats and write original recaps before editing data/recaps.json."}
    args.out.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {len(ready)} completed games; flagged {len(flagged)} to {args.out}")


if __name__ == "__main__":
    main()
