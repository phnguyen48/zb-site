#!/usr/bin/env python3
"""
Refreshes market.json from Redfin's free Data Center downloads.

Run by .github/workflows/update-market.yml every 3 days. It reads Redfin's
city- and ZIP-level "Housing Market Tracker" files, keeps the newest numbers
for every Bay Area city and ZIP code, and writes a small market.json that the
website reads when it loads.

Redfin moved these files in May 2026; the old redfin_market_tracker/*.tsv000.gz
downloads stopped updating then. The current files (newest rows first) live at
https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_data_center/

Data: Redfin, a national real estate brokerage (https://www.redfin.com/news/data-center/).
"""
import csv, io, json, os, re, sys, urllib.request
from datetime import date

BASE = "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_data_center/housing_market/monthly/"
FILES = {"city": BASE + "all_cities.csv", "zip": BASE + "all_zips.csv"}
OUT = "market.json"
HERE = os.path.dirname(os.path.abspath(__file__))

# Cities: the city file has no metro column, so we keep the Bay Area cities listed in
# scripts/bay_area_cities.txt (one per line; add a line to include another city).
with open(os.path.join(HERE, "bay_area_cities.txt")) as f:
    BAY_AREA_CITIES = {l.strip() for l in f if l.strip()}
# ZIP codes: kept when their METRO column contains one of these names.
BAY_AREA_METROS = ["San Jose", "San Francisco", "Oakland", "San Rafael", "Fremont",
                   "Hayward", "Santa Rosa", "Vallejo", "Napa", "Santa Cruz"]
MIN_SALES = 3          # skip places with too few sales to be meaningful
MIN_CITIES = 20        # safety net: never overwrite good data with a broken run

csv.field_size_limit(10**9)


def num(v):
    v = (v or "").strip()
    if v in ("", "NA", "null", "None"):
        return None
    try:
        return float(v)
    except ValueError:
        return None


def rows(url, local=None):
    """Yield each row as a dict keyed by upper-case column name, streaming (files are >1 GB)."""
    raw = open(local, "rb") if local else urllib.request.urlopen(url, timeout=600)
    text = io.TextIOWrapper(raw, encoding="utf-8", newline="")
    reader = csv.reader(text)
    header = [h.strip().upper() for h in next(reader)]
    for r in reader:
        yield dict(zip(header, r))


def collect(kind, local=None, full_scan=False):
    """Newest numbers per place. Rows come newest-first, so we stop once the
    period gets older than the newest one, unless full_scan is set."""
    best, newest = {}, None
    for row in rows(FILES[kind], local):
        g = lambda k: (row.get(k) or "").strip()
        end = g("PERIOD END")[:10]
        if not re.match(r"\d{4}-\d{2}-\d{2}$", end):
            continue
        if newest is None or end > newest:
            newest = end
        elif end < newest and not full_scan:
            break
        if kind == "city":
            name = g("REGION NAME")
            if not name.endswith(", CA"):
                continue
            key = name[:-4].strip()
            if key not in BAY_AREA_CITIES:
                continue
        else:
            m = re.search(r"\b(\d{5})\b", g("REGION NAME"))
            metro = g("METRO")
            if not m or not any(b in metro for b in BAY_AREA_METROS):
                continue
            key = m.group(1)
        price, sold = num(g("MEDIAN SALE PRICE NSA ($)")), num(g("HOMES SOLD"))
        if not price or sold is None or sold < MIN_SALES:
            continue
        dom, stl, above = num(g("MEDIAN DAYS ON MARKET (DAYS)")), num(g("AVERAGE SALE TO LIST RATIO (%)")), num(g("SHARE SOLD ABOVE ORIGINAL LIST (%)"))
        rec = {
            "p": round(price),
            "d": round(dom) if dom is not None else None,
            "s": round(stl, 1) if stl is not None else None,
            "a": round(above, 1) if above is not None else None,
            "n": int(sold),
            "e": end,
            "w": 90 if "3" in g("FREQUENCY") else 30,
        }
        if kind == "zip":
            rec["m"] = metro.split(",")[0]
        old = best.get(key)
        if old is None or rec["e"] > old["e"]:
            best[key] = rec
    return best


def main():
    # Optional for testing: update_market.py cities.csv zips.csv (local copies)
    local = sys.argv[1:3] if len(sys.argv) >= 3 else (None, None)
    cities = collect("city", local[0])
    if len(cities) < MIN_CITIES:  # in case Redfin stops sorting newest-first
        cities = collect("city", local[0], full_scan=True)
    zips = collect("zip", local[1])
    if len(zips) < MIN_CITIES:
        zips = collect("zip", local[1], full_scan=True)
    print(f"Bay Area cities: {len(cities)}  ZIP codes: {len(zips)}")
    if len(cities) < MIN_CITIES:
        sys.exit(f"Only {len(cities)} cities found; Redfin's format may have changed. Keeping the old market.json.")
    latest = max(r["e"] for r in list(cities.values()) + list(zips.values()))
    data = {
        "updated": latest,
        "generated": date.today().isoformat(),
        "source": "Redfin, a national real estate brokerage",
        "cities": dict(sorted(cities.items())),
        "zips": dict(sorted(zips.items())),
    }
    with open(OUT, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print(f"Wrote {OUT}, data through {latest}")


if __name__ == "__main__":
    main()
