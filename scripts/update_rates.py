#!/usr/bin/env python3
"""
Refreshes rates.json with the latest average mortgage rates for the listing pages'
monthly payment estimate.

Run daily by .github/workflows/update-rates.yml. Source: Freddie Mac's Primary Mortgage
Market Survey (published weekly, usually Thursdays), downloaded from the St. Louis Fed's
free FRED service (no API key needed).
"""
import csv, io, json, sys, urllib.request
from datetime import date, datetime

OUT = "rates.json"
SERIES = {"rate30": "MORTGAGE30US", "rate15": "MORTGAGE15US"}
URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id={}"


def latest(series_id, local=None):
    """Return (date, rate) for the most recent week that has a number."""
    text = open(local).read() if local else urllib.request.urlopen(
        urllib.request.Request(URL.format(series_id), headers={"User-Agent": "zb-site rate updater"}), timeout=60
    ).read().decode()
    rows = [r for r in csv.reader(io.StringIO(text)) if len(r) >= 2]
    for d, v in reversed(rows[1:]):
        try:
            return datetime.strptime(d.strip(), "%Y-%m-%d").date(), float(v)
        except ValueError:
            continue  # "." means no value that week
    raise ValueError(f"no rate found for {series_id}")


def main():
    # Optional for testing: update_rates.py 30yr.csv 15yr.csv (local copies)
    local = sys.argv[1:3] if len(sys.argv) >= 3 else (None, None)
    out = {}
    for (key, sid), loc in zip(SERIES.items(), local):
        d, r = latest(sid, loc)
        if not 1 <= r <= 20:
            sys.exit(f"{sid} rate {r} looks wrong; keeping the old rates.json.")
        if (date.today() - d).days > 45:
            sys.exit(f"{sid} hasn't been updated since {d}; keeping the old rates.json.")
        out[key] = r
        out["week_of"] = d.isoformat()
    out["source"] = "Freddie Mac Primary Mortgage Market Survey (via FRED)"
    with open(OUT, "w") as f:
        json.dump(out, f, indent=2)
        f.write("\n")
    print(f"30-year {out['rate30']}%, 15-year {out['rate15']}%, week of {out['week_of']}")


if __name__ == "__main__":
    main()
