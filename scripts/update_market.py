#!/usr/bin/env python3
"""
Refreshes market.json from Redfin's free Data Center downloads.

Run by .github/workflows/update-market.yml every 3 days. It streams Redfin's
city- and ZIP-level market tracker files, keeps the newest numbers for every
Bay Area city and ZIP code, and writes a small market.json that the website
reads when it loads.

Data: Redfin, a national real estate brokerage (https://www.redfin.com/news/data-center/).
"""
import csv, gzip, io, json, re, sys, urllib.request
from datetime import date, datetime

BASE = "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/"
FILES = {"city": BASE + "city_market_tracker.tsv000.gz",
         "zip":  BASE + "zip_code_market_tracker.tsv000.gz"}
OUT = "market.json"

# Redfin tags each city/ZIP with its metro area. Any metro whose name contains
# one of these words counts as Bay Area (covers all nine counties + Santa Cruz).
BAY_AREA_METROS = ["San Jose", "San Francisco", "Oakland", "San Rafael", "Fremont",
                   "Hayward", "Santa Rosa", "Vallejo", "Napa", "Santa Cruz"]
MIN_SALES = 3          # skip places with too few sales to be meaningful
MIN_CITIES = 20        # safety net: never overwrite good data with a broken run

csv.field_size_limit(10**9)


def num(v):
    try:
        v = (v or "").strip().strip('"')
        return float(v) if v not in ("", "NA", "null", "None") else None
    except ValueError:
        return None


def rows(url, local=None):
    """Yield each row as a dict with lowercase keys, streaming (files are large)."""
    raw = open(local, "rb") if local else urllib.request.urlopen(url, timeout=600)
    text = io.TextIOWrapper(gzip.GzipFile(fileobj=raw), encoding="utf-8", newline="")
    reader = csv.reader(text, delimiter="\t", quotechar='"')
    header = [h.strip().strip('"').lower() for h in next(reader)]
    for r in reader:
        yield dict(zip(header, r))


def is_bay_area(row):
    if (row.get("state_code") or "").strip('"') != "CA":
        return False
    metro = (row.get("parent_metro_region") or "").strip('"')
    if not metro:  # column missing in an older format: keep all of California
        return "parent_metro_region" not in row
    return any(m in metro for m in BAY_AREA_METROS)


def better(new, old):
    """Prefer the newest period; on a tie prefer the shorter (fresher) window."""
    if old is None:
        return True
    if new["e"] != old["e"]:
        return new["e"] > old["e"]
    return new["w"] < old["w"]


def collect(kind, local=None):
    best = {}
    for row in rows(FILES[kind], local):
        g = lambda k: (row.get(k) or "").strip().strip('"')
        if g("property_type") not in ("All Residential", ""):
            continue
        if g("is_seasonally_adjusted").lower() in ("true", "t", "1"):
            continue
        if not is_bay_area(row):
            continue
        price, dom, stl = num(g("median_sale_price")), num(g("median_dom")), num(g("avg_sale_to_list"))
        above, sold = num(g("sold_above_list")), num(g("homes_sold"))
        if not price or sold is None or sold < MIN_SALES:
            continue
        region = g("region")
        if kind == "zip":
            m = re.search(r"\b(\d{5})\b", region)
            if not m:
                continue
            key = m.group(1)
        else:
            key = g("city") or region.split(",")[0]
            key = key.strip()
        try:
            end = datetime.strptime(g("period_end")[:10], "%Y-%m-%d").date().isoformat()
        except ValueError:
            continue
        rec = {
            "p": round(price),
            "d": round(dom) if dom is not None else None,
            "s": round(stl * 100 if stl and stl < 3 else stl, 1) if stl else None,
            "a": round(above * 100 if above is not None and above <= 1 else above, 1) if above is not None else None,
            "n": int(sold),
            "e": end,
            "w": int(num(g("period_duration")) or 30),
        }
        if kind == "zip" and g("parent_metro_region"):
            rec["m"] = g("parent_metro_region").split(",")[0]
        if better(rec, best.get(key)):
            best[key] = rec
    return best


def main():
    # Optional: pass local copies for testing -> update_market.py city.tsv.gz zip.tsv.gz
    local = sys.argv[1:3] if len(sys.argv) >= 3 else (None, None)
    cities = collect("city", local[0])
    zips = collect("zip", local[1])
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
