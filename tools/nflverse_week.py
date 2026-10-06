#!/usr/bin/env python3
"""Pull advanced stats for an NFL week from nflverse play-by-play data.

Usage:
    python3 nflverse_week.py --season 2026 --week 5 [--out week5.json]

Downloads (and caches) the season's play-by-play parquet from nflverse,
then emits compact JSON per game: team EPA, success rates, biggest
win-probability swings, top EPA plays, and turnovers. Built to ground
Highlight Corner's weekly recaps in real advanced stats.

Data: https://github.com/nflverse/nflverse-data (CC-BY-4.0, attribution required)
Requires: duckdb (`pip install duckdb`)
"""
import argparse
import json
import os
import subprocess
import sys
import time

CACHE_DIR = os.path.expanduser("~/.cache/nflverse")
URL = "https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_{season}.parquet"
STALE_SECS = 12 * 3600  # re-download if older than 12h (nightly upstream updates)


def ensure_parquet(season: int) -> str:
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = os.path.join(CACHE_DIR, f"play_by_play_{season}.parquet")
    stale = (not os.path.exists(path)
             or time.time() - os.path.getmtime(path) > STALE_SECS)
    if stale:
        url = URL.format(season=season)
        print(f"downloading {url} ...", file=sys.stderr)
        r = subprocess.run(["curl", "-sSL", "--fail", "-o", path, url])
        if r.returncode != 0 or not os.path.exists(path):
            sys.exit(f"failed to download {url}")
    return path


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int, required=True)
    ap.add_argument("--week", type=int, required=True)
    ap.add_argument("--out", default=None, help="write JSON here instead of stdout")
    args = ap.parse_args()

    import duckdb
    path = ensure_parquet(args.season)
    con = duckdb.connect()

    games = con.execute(
        """SELECT DISTINCT game_id, away_team, home_team, away_score, home_score
           FROM read_parquet(?)
           WHERE week = ? AND season_type = 'REG'
           ORDER BY game_id""",
        [path, args.week]).fetchall()

    out = []
    for game_id, away, home, a_score, h_score in games:
        q_cols = ('posteam, qtr, down, ydstogo, play_type, passer_player_name, '
                  'rusher_player_name, receiver_player_name, '
                  'ROUND(epa,2), ROUND(wpa,3), "desc"')

        team_epa = {}
        for team, tot, per, succ, n in con.execute(
                f"""SELECT posteam, ROUND(SUM(epa),1), ROUND(AVG(epa),2),
                           ROUND(AVG(success),3), COUNT(*)
                    FROM read_parquet(?) WHERE game_id = ? AND epa IS NOT NULL
                    GROUP BY posteam ORDER BY 2 DESC""",
                [path, game_id]).fetchall():
            if team:
                team_epa[team] = {"total_epa": tot, "epa_per_play": per,
                                  "success_rate": succ, "plays": n}

        def play_dict(r):
            posteam, qtr, down, ydstogo, ptype, passer, rusher, receiver, epa, wpa, desc = r
            who = passer or rusher or receiver or ""
            return {"team": posteam, "qtr": qtr, "down": down, "to_go": ydstogo,
                    "type": ptype, "player": who, "epa": epa, "wpa": wpa,
                    "desc": (desc or "")[:160]}

        cols = q_cols

        biggest_wpa = [play_dict(r) for r in con.execute(
            f"""SELECT {cols} FROM read_parquet(?) WHERE game_id = ? AND wpa IS NOT NULL
                ORDER BY ABS(wpa) DESC LIMIT 3""", [path, game_id]).fetchall()]

        top_epa = [play_dict(r) for r in con.execute(
            f"""SELECT {cols} FROM read_parquet(?) WHERE game_id = ? AND epa IS NOT NULL
                ORDER BY epa DESC LIMIT 3""", [path, game_id]).fetchall()]

        worst_epa = [play_dict(r) for r in con.execute(
            f"""SELECT {cols} FROM read_parquet(?) WHERE game_id = ? AND epa IS NOT NULL
                ORDER BY epa ASC LIMIT 3""", [path, game_id]).fetchall()]

        turnovers = [play_dict(r) for r in con.execute(
            f"""SELECT {cols} FROM read_parquet(?)
                WHERE game_id = ? AND (interception = 1 OR fumble_lost = 1)
                ORDER BY epa ASC""", [path, game_id]).fetchall()]

        out.append({
            "game_id": game_id, "away": away, "home": home,
            "away_score": a_score, "home_score": h_score,
            "team_epa": team_epa,
            "biggest_wpa_swings": biggest_wpa,
            "top_epa_plays": top_epa,
            "worst_epa_plays": worst_epa,
            "turnovers": turnovers,
        })

    result = {"season": args.season, "week": args.week,
              "games_found": len(out), "games": out,
              "source": "nflverse play-by-play (CC-BY-4.0)"}
    text = json.dumps(result, indent=1)
    if args.out:
        with open(args.out, "w") as f:
            f.write(text)
        print(f"wrote {args.out} ({len(out)} games)", file=sys.stderr)
    else:
        print(text)


if __name__ == "__main__":
    main()
