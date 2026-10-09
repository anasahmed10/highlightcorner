#!/usr/bin/env python3
"""Refresh the compact Sleeper player map used by fantasy.html.

Run from the repository root: python3 tools/refresh_players.py --out data/players.json
Review the diff before committing. Existing IDs are retained for historical weeks.
"""
import argparse
import json
from pathlib import Path
from urllib.request import urlopen

SOURCE = "https://api.sleeper.app/v1/players/nfl"
POSITIONS = {"QB", "RB", "WR", "TE", "K"}
TEAMS = set("ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS WSH".split())


def build_map(source, existing):
    if not isinstance(source, dict) or len(source) < 100:
        raise ValueError("Sleeper player response is missing or unexpectedly small")
    if not isinstance(existing, dict):
        raise ValueError("Existing player map must be an object")
    result = dict(existing)
    refreshed = 0
    for player_id, player in source.items():
        if not isinstance(player_id, str) or not player_id.isdigit() or not isinstance(player, dict):
            continue
        if str(player.get("player_id", player_id)) != player_id:
            continue
        if not player.get("active") or not isinstance(player.get("position"), str) or player["position"] not in POSITIONS:
            continue
        name = player.get("full_name")
        if not name:
            parts = (player.get("first_name"), player.get("last_name"))
            if not all(part is None or isinstance(part, str) for part in parts):
                continue
            name = " ".join(part for part in parts if part)
        team = player.get("team")
        if not isinstance(name, str) or not name.strip() or not isinstance(team, str) or team.upper() not in TEAMS:
            continue
        result[player_id] = {"n": name.strip(), "p": player["position"], "t": team.upper()}
        refreshed += 1
    if refreshed < 100:
        raise ValueError("Too few eligible active players; refusing to replace the map")
    for player_id, info in result.items():
        if not isinstance(player_id, str) or not isinstance(info, dict) or set(info) != {"n", "p", "t"}:
            raise ValueError(f"Invalid player entry: {player_id}")
        defense = player_id in TEAMS and info["p"] == "DEF" and info["t"] == player_id
        player = player_id.isascii() and player_id.isdigit() and isinstance(info["p"], str) and info["p"] in POSITIONS
        if (not (player or defense) or not isinstance(info["n"], str) or not info["n"].strip() or
                not isinstance(info["t"], str) or info["t"] not in TEAMS):
            raise ValueError(f"Invalid player entry: {player_id}")
    return dict(sorted(result.items(), key=lambda item: (not item[0].isdigit(), int(item[0]) if item[0].isdigit() else item[0]))), refreshed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True, type=Path, help="Output map (review before committing)")
    parser.add_argument("--existing", type=Path, default=Path("data/players.json"))
    args = parser.parse_args()
    with urlopen(SOURCE, timeout=30) as response:
        source = json.load(response)
    existing = json.loads(args.existing.read_text()) if args.existing.exists() else {}
    players, refreshed = build_map(source, existing)
    args.out.write_text(json.dumps(players, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Wrote {len(players)} players ({refreshed} refreshed) from {SOURCE} to {args.out}")


if __name__ == "__main__":
    main()
