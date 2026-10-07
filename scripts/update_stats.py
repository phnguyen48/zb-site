#!/usr/bin/env python3
"""
Refreshes stats.json: Zach's YouTube channel views and Instagram follower count.

Run daily by .github/workflows/update-stats.yml. Each source is optional:
if its secret isn't set, or the request fails, the previous number is kept.

  YT_API_KEY       YouTube Data API v3 key (Google Cloud, free)
  IG_ACCESS_TOKEN  Instagram API long-lived access token for @zachbelman
                   (refreshed on every run; the new token is written to
                   $IG_NEW_TOKEN_FILE so the workflow can save it back)
"""
import json, os, sys, urllib.parse, urllib.request
from datetime import date

OUT = "stats.json"
YT_HANDLE = "@Moving2SanJose"


def get(url):
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)


def main():
    try:
        with open(OUT) as f:
            stats = json.load(f)
    except (OSError, ValueError):
        stats = {}
    stats.setdefault("youtube", {})
    stats.setdefault("instagram", {})
    changed = False

    key = os.environ.get("YT_API_KEY", "").strip()
    if key:
        try:
            q = urllib.parse.urlencode({"part": "statistics", "forHandle": YT_HANDLE, "key": key})
            s = get("https://www.googleapis.com/youtube/v3/channels?" + q)["items"][0]["statistics"]
            stats["youtube"].update({"views": int(s["viewCount"]),
                                     "subscribers": int(s.get("subscriberCount", 0)) or None,
                                     "updated": date.today().isoformat()})
            changed = True
            print(f"YouTube: {s['viewCount']} views")
        except Exception as e:  # keep the old number
            print(f"::warning::YouTube update failed: {e}")
    else:
        print("YT_API_KEY not set; keeping the current YouTube number.")

    token = os.environ.get("IG_ACCESS_TOKEN", "").strip()
    if token:
        try:
            q = urllib.parse.urlencode({"fields": "followers_count", "access_token": token})
            n = get("https://graph.instagram.com/me?" + q)["followers_count"]
            stats["instagram"].update({"followers": int(n), "updated": date.today().isoformat()})
            changed = True
            print(f"Instagram: {n} followers")
        except Exception as e:
            print(f"::warning::Instagram update failed: {e}")
        # Long-lived Instagram tokens last 60 days; refresh so it never runs out.
        try:
            q = urllib.parse.urlencode({"grant_type": "ig_refresh_token", "access_token": token})
            new = get("https://graph.instagram.com/refresh_access_token?" + q).get("access_token")
            out = os.environ.get("IG_NEW_TOKEN_FILE")
            if new and out:
                print(f"::add-mask::{new}")
                with open(out, "w") as f:
                    f.write(new)
        except Exception as e:
            print(f"::warning::Instagram token refresh failed: {e}")
    else:
        print("IG_ACCESS_TOKEN not set; keeping the current Instagram number.")

    if changed:
        with open(OUT, "w") as f:
            json.dump(stats, f, indent=2)
            f.write("\n")


if __name__ == "__main__":
    sys.exit(main())
