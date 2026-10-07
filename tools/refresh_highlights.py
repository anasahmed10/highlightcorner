#!/usr/bin/env python3
"""Match official NFL YouTube uploads to ESPN games; publish a static link map.

Uses YouTube Data API v3, never YouTube/NFL.com page scraping. The API key is
read from YOUTUBE_API_KEY and is never written into the public output.
"""
import argparse
from datetime import datetime, timedelta, timezone
import html
import json
import os
from pathlib import Path
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

NFL_CHANNEL = "UCDVYQ4Zhbm3S2dlz7P1GBDg"
SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
YOUTUBE = "https://www.googleapis.com/youtube/v3/"
MAX_PAGES = 300
VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
TITLE = re.compile(
    r"^(.+?)\s+vs\.?\s+(.+?)\s+(?:full\s+)?game highlights"
    r"(?: from Rio)?(?:\s+Week\s+(\d+))?\s*\|\s*"
    r"(?:NFL\s+)?(20\d{2})(?:\s+NFL)?(?:\s+Season)?"
    r"(?:\s+Week\s+(\d+))?(?:\s+Melbourne Game)?\s*$",
    re.IGNORECASE,
)


def normalized(value):
    return re.sub(r"[^a-z0-9]", "", html.unescape(value).lower())


def fetch_json(url, provider="ESPN"):
    request = urllib.request.Request(url, headers={"User-Agent": "HighlightCorner/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        # HTTPError's string contains the request URL, which can include the key.
        raise RuntimeError(f"{provider} returned HTTP {error.code}") from None
    except (urllib.error.URLError, TimeoutError, ValueError):
        raise RuntimeError(f"{provider} request failed") from None


def youtube(resource, key, **params):
    params["key"] = key
    return fetch_json(YOUTUBE + resource + "?" + urllib.parse.urlencode(params), "YouTube API")


def schedule():
    current = fetch_json(SCOREBOARD)
    season = int(current["season"]["year"])
    season_type = int(current["season"]["type"])
    if season_type != 2:
        raise RuntimeError("Automatic highlights currently support the regular season only")
    week = int(current["week"]["number"])
    if not 1 <= week <= 18:
        raise RuntimeError("ESPN reported an unsupported regular-season week")
    games = []
    for number in range(1, week + 1):
        params = urllib.parse.urlencode({"dates": season, "seasontype": 2, "week": number})
        data = fetch_json(SCOREBOARD + "?" + params)
        # Refuse an upstream response that ignored the season/week selection.
        if (int(data["season"]["year"]) != season or int(data["season"]["type"]) != 2
                or int(data["week"]["number"]) != number):
            raise RuntimeError("ESPN season/week selection did not match the request")
        for event in data.get("events", []):
            if not event.get("status", {}).get("type", {}).get("completed"):
                continue
            competitors = event.get("competitions", [{}])[0].get("competitors", [])
            sides = {c.get("homeAway"): c.get("team", {}) for c in competitors}
            if not all(sides.get(side, {}).get("id") for side in ("away", "home")):
                continue
            games.append({"id": str(event["id"]), "season": season, "week": number,
                          "date": event["date"], "away": sides["away"], "home": sides["home"]})
    return season, games


def match_title(title, games):
    match = TITLE.fullmatch(html.unescape(title).strip())
    if not match:
        return None
    first, second, early_week, season, late_week = match.groups()
    if bool(early_week) == bool(late_week):
        return None
    week = early_week or late_week
    names = {normalized(first), normalized(second)}
    if len(names) != 2:
        return None
    matches = []
    for game in games:
        if (game["season"], game["week"]) != (int(season), int(week)):
            continue
        aliases = [
            {normalized(team.get(field, "")) for field in
             ("displayName", "shortDisplayName", "name", "abbreviation")} - {""}
            for team in (game["away"], game["home"])
        ]
        if ((normalized(first) in aliases[0] and normalized(second) in aliases[1]) or
                (normalized(first) in aliases[1] and normalized(second) in aliases[0])):
            matches.append(game)
    return matches[0] if len(matches) == 1 else None


def discover(key, games):
    channel = youtube("channels", key, part="contentDetails", id=NFL_CHANNEL).get("items", [])
    if len(channel) != 1 or channel[0].get("id") != NFL_CHANNEL:
        raise RuntimeError("Could not verify the official NFL channel")
    playlist = channel[0]["contentDetails"]["relatedPlaylists"]["uploads"]
    if not games:
        return {}
    cutoff = min(datetime.fromisoformat(g["date"].replace("Z", "+00:00")) for g in games) - timedelta(days=2)
    candidates = {}
    token = ""
    seen = set()
    for _ in range(MAX_PAGES):
        params = {"part": "snippet,contentDetails", "playlistId": playlist, "maxResults": 50}
        if token:
            params["pageToken"] = token
        page = youtube("playlistItems", key, **params)
        items = page.get("items", [])
        dates = []
        for item in items:
            snippet = item.get("snippet", {})
            detail = item.get("contentDetails", {})
            published = detail.get("videoPublishedAt")
            if published:
                dates.append(datetime.fromisoformat(published.replace("Z", "+00:00")))
            game = match_title(snippet.get("title", ""), games)
            video_id = detail.get("videoId", "")
            if game and VIDEO_ID.fullmatch(video_id):
                candidates.setdefault(video_id, game)
        next_token = page.get("nextPageToken", "")
        if not next_token or not items or (dates and max(dates) < cutoff):
            break
        if next_token in seen:
            raise RuntimeError("YouTube returned a repeated pagination token")
        seen.add(next_token)
        token = next_token
    else:
        raise RuntimeError("YouTube upload scan exceeded its request limit")

    # Verify actual video ownership, public visibility, and the latest title.
    output = {}
    now = datetime.now(timezone.utc).isoformat()
    ids = list(candidates)
    for start in range(0, len(ids), 50):
        videos = youtube("videos", key, part="snippet,status", id=",".join(ids[start:start + 50]))
        for video in videos.get("items", []):
            snippet = video.get("snippet", {})
            if snippet.get("channelId") != NFL_CHANNEL or video.get("status", {}).get("privacyStatus") != "public":
                continue
            video_id = video.get("id", "")
            game = match_title(snippet.get("title", ""), games)
            if game is None or not VIDEO_ID.fullmatch(video_id) or game["id"] in output:
                continue
            output[game["id"]] = {"url": "https://www.youtube.com/watch?v=" + video_id,
                                   "source": "YouTube", "channelId": NFL_CHANNEL,
                                   "season": game["season"], "week": game["week"],
                                   "away": game["away"]["abbreviation"],
                                   "home": game["home"]["abbreviation"], "verifiedAt": now}
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("data/highlights.json"))
    parser.add_argument("--optional", action="store_true", help="Preserve the previous map if discovery is unavailable")
    parser.add_argument("--previous-url", help="Reuse the last deployed static map if the API is unavailable")
    args = parser.parse_args()
    try:
        if args.previous_url:
            try:
                previous = fetch_json(args.previous_url, "Published highlight map")
                if previous.get("version") == 1 and previous.get("status") == "ready" and isinstance(previous.get("games"), dict):
                    args.out.parent.mkdir(parents=True, exist_ok=True)
                    args.out.write_text(json.dumps(previous, indent=2) + "\n")
            except (RuntimeError, AttributeError):
                print("Published map unavailable; using the repository snapshot", file=sys.stderr)
        key = os.environ.get("YOUTUBE_API_KEY", "")
        if not key:
            raise RuntimeError("Set the YOUTUBE_API_KEY repository Actions secret to enable discovery")
        season, games = schedule()
        mapping = discover(key, games)
        output = {"version": 1, "status": "ready", "season": season,
                  "updatedAt": datetime.now(timezone.utc).isoformat(), "games": mapping}
        args.out.parent.mkdir(parents=True, exist_ok=True)
        temporary = args.out.with_suffix(".tmp")
        temporary.write_text(json.dumps(output, indent=2) + "\n")
        temporary.replace(args.out)
        print(f"Mapped {len(mapping)} of {len(games)} completed games to official NFL videos")
        return 0
    except (RuntimeError, KeyError, TypeError, ValueError) as error:
        # Only sanitized failures reach this output; never print API request URLs.
        print(f"Highlight refresh unavailable: {error}", file=sys.stderr)
        if args.optional and args.out.exists():
            print("Preserved the existing highlight map", file=sys.stderr)
            return 0
        return 1


if __name__ == "__main__":
    sys.exit(main())
