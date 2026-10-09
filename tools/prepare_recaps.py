#!/usr/bin/env python3
"""Prepare sourced NFL game facts and validate editorial recaps; never writes recaps.json.

Run: python3 tools/prepare_recaps.py --season 2026 --week 5 --out /tmp/hc-week5.json
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
SUMMARY = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary"
VERDICTS = {"nail-biter", "comfortable", "garbage-time", "blowout"}


def fetch(url):
    with urlopen(url, timeout=15) as response:
        return json.load(response)


def is_final(event):
    status = event.get("status") if isinstance(event, dict) else None
    status_type = status.get("type") if isinstance(status, dict) else None
    return isinstance(status_type, dict) and status_type.get("completed") is True


def validate_recaps(recaps, season, week, games):
    if not isinstance(recaps, list):
        raise ValueError("Recaps must be a JSON array")
    seen = set()
    errors = []
    for index, recap in enumerate(recaps):
        if not isinstance(recap, dict):
            errors.append(f"entry {index}: expected an object")
            continue
        key = str(recap.get("gameId"))
        if key in seen:
            errors.append(f"entry {index}: duplicate ESPN game ID")
        seen.add(key)
        if type(recap.get("season")) is not int or not 2020 <= recap["season"] <= 2100:
            errors.append(f"entry {index}: invalid season")
        if type(recap.get("week")) is not int or not 1 <= recap["week"] <= 18:
            errors.append(f"entry {index}: invalid regular-season week")
        if not isinstance(recap.get("gameId"), str) or not recap["gameId"].isdigit():
            errors.append(f"entry {index}: invalid ESPN game ID")
        if not isinstance(recap.get("verdict"), str) or recap["verdict"] not in VERDICTS:
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
    if len(competitors) != 2 or set(teams) != {"away", "home"}:
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
        if not isinstance(event, dict):
            flagged.append({"gameId": None, "reason": "Invalid ESPN game entry"})
            continue
        game_id = str(event.get("id", ""))
        try:
            if not is_final(event):
                flagged.append({"gameId": game_id, "reason": "Game is not final"})
                continue
            fact = game_fact(event)
            summary = summaries.get(game_id)
            if not isinstance(summary, dict):
                raise ValueError("Summary is unavailable")
            header = summary.get("header", {})
            if (str(header.get("id")) != game_id or header.get("season", {}).get("year") != season or
                    header.get("season", {}).get("type") != 2 or header.get("week") != week):
                raise ValueError("Summary ID or season/week does not match")
            summary_competition = header.get("competitions", [{}])[0]
            summary_status = header.get("status") or summary_competition.get("status") or {}
            if not summary_status.get("type", {}).get("completed"):
                raise ValueError("Summary is not final")
            summary_teams = {team.get("homeAway"): team for team in
                             summary_competition.get("competitors", [])}
            if len(summary_competition.get("competitors", [])) != 2 or set(summary_teams) != {"away", "home"}:
                raise ValueError("Summary has incomplete competitors")
            for side in ("away", "home"):
                if summary_teams[side].get("team", {}).get("abbreviation") != fact[side]:
                    raise ValueError("Summary matchup differs from scoreboard")
                if str(summary_teams.get(side, {}).get("score")) != str(fact[side + "Score"]):
                    raise ValueError("Summary final score differs from scoreboard")
            fact["summaryUrl"] = SUMMARY + "?" + urlencode({"event": game_id})
            fact["scoringPlays"] = [
                {"period": play.get("period", {}).get("number"), "clock": play.get("clock", {}).get("displayValue"),
                 "text": play.get("text"), "awayScore": play.get("awayScore"), "homeScore": play.get("homeScore")}
                for play in summary.get("scoringPlays", [])]
            ready.append(fact)
        except (ValueError, KeyError, IndexError, TypeError, AttributeError) as error:
            flagged.append({"gameId": game_id, "reason": str(error)})
    return ready, flagged


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--season", type=int, required=True)
    parser.add_argument("--week", type=int, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--recaps", type=Path, default=Path("data/recaps.json"))
    args = parser.parse_args()
    production_recaps = Path(__file__).resolve().parents[1] / "data/recaps.json"
    if args.out.resolve() in {args.recaps.resolve(), production_recaps.resolve()}:
        parser.error("Supporting facts cannot overwrite an editorial recap archive; choose another --out path")
    if not 2020 <= args.season <= 2100 or not 1 <= args.week <= 18:
        parser.error("Only regular-season years 2020–2100 and weeks 1–18 are supported")
    scoreboard_url = SCOREBOARD + "?" + urlencode({"dates": args.season, "seasontype": 2, "week": args.week})
    scoreboard = fetch(scoreboard_url)
    if (scoreboard.get("season", {}).get("year"), scoreboard.get("season", {}).get("type"),
            scoreboard.get("week", {}).get("number")) != (args.season, 2, args.week):
        raise SystemExit("ESPN did not return the requested regular-season week")
    summaries = {}
    for event in scoreboard.get("events", []):
        if is_final(event) and str(event.get("id", "")).isdigit():
            try:
                summaries[str(event["id"])] = fetch(SUMMARY + "?" + urlencode({"event": event["id"]}))
            except (OSError, ValueError):
                pass  # Flag delayed/unavailable summaries instead of inventing supporting facts.
    ready, flagged = prepare(scoreboard, summaries, args.season, args.week)
    recaps = json.loads(args.recaps.read_text())
    final_games = {}
    for event in scoreboard.get("events", []):
        if is_final(event):
            try:
                game = game_fact(event)
                final_games[game["gameId"]] = game
            except (ValueError, KeyError, IndexError, TypeError, AttributeError):
                pass
    errors = validate_recaps(recaps, args.season, args.week, final_games)
    if errors:
        raise SystemExit("Recap validation failed:\n" + "\n".join(errors))
    output = {"season": args.season, "week": args.week, "source": "ESPN NFL scoreboard and game summaries",
              "scoreboardUrl": scoreboard_url, "fetchedAt": datetime.now(timezone.utc).isoformat(),
              "ready": ready, "flagged": flagged,
              "editorialNote": "Supporting facts only. Verify key stats and write original recaps before editing data/recaps.json."}
    args.out.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {len(ready)} completed games; flagged {len(flagged)} to {args.out}")


if __name__ == "__main__":
    main()
