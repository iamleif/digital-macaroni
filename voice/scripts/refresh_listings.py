"""
Juniper Row Realty's listings: one RentCast request for active Austin sale listings, trimmed to a
spread across our areas and prices, written to app/demos/realestate/data/listings.json. The agent only
ever reads that file (through store.py), so a call never spends RentCast quota on a search.

    RENTCAST_API_KEY=… uv run python scripts/refresh_listings.py
"""

from __future__ import annotations

import json
import os
import sys
from datetime import date
from pathlib import Path

import httpx

DATA = Path(__file__).resolve().parents[1] / "app" / "demos" / "realestate" / "data"
PER_AREA = 9
TYPES = ("Single Family", "Condo", "Townhouse")


def main() -> None:
    key = os.environ.get("RENTCAST_API_KEY")
    if not key:
        sys.exit("Set RENTCAST_API_KEY.")
    areas = json.loads((DATA / "areas.json").read_text())["areas"]
    area_of = {z: a["id"] for a in areas for z in a["zips"]}
    r = httpx.get(
        "https://api.rentcast.io/v1/listings/sale",
        params={"city": "Austin", "state": "TX", "status": "Active", "propertyType": "|".join(TYPES), "limit": 500},
        headers={"X-Api-Key": key, "Accept": "application/json"},
        timeout=60,
    )
    r.raise_for_status()
    rows = [x for x in r.json() if x.get("zipCode") in area_of and x.get("price") and x.get("bedrooms") and x.get("bathrooms") and x.get("squareFootage") and x.get("propertyType") in TYPES]
    picked: list[dict] = []
    for a in areas:
        mine = sorted((x for x in rows if area_of[x["zipCode"]] == a["id"]), key=lambda x: x["price"])
        if len(mine) > PER_AREA:
            # An even spread of prices, cheapest to dearest.
            step = (len(mine) - 1) / (PER_AREA - 1)
            mine = [mine[round(i * step)] for i in range(PER_AREA)]
        picked += [{**x, "_area": a["id"]} for x in mine]
    listings = [
        {
            "id": f"JR-{i + 101}",
            "address": x["addressLine1"] + (f" {x['addressLine2']}" if x.get("addressLine2") else ""),
            "street": " ".join(w for w in x["addressLine1"].split() if not w.isdigit()),
            "city": x.get("city", "Austin"),
            "zip": x["zipCode"],
            "area": x["_area"],
            "type": x["propertyType"],
            "price": int(x["price"]),
            "beds": x["bedrooms"],
            "baths": x["bathrooms"],
            "sqft": x["squareFootage"],
            "lotSqft": x.get("lotSize"),
            "yearBuilt": x.get("yearBuilt"),
            "hoaFee": (x.get("hoa") or {}).get("fee"),
            "newConstruction": x.get("listingType") == "New Construction",
            "listedDate": (x.get("listedDate") or "")[:10] or None,
            "daysOnMarket": x.get("daysOnMarket"),
            "latitude": x.get("latitude"),
            "longitude": x.get("longitude"),
        }
        for i, x in enumerate(picked)
    ]
    out = {"source": "RentCast sale listings, Austin TX", "snapshot": date.today().isoformat(), "listings": listings}
    (DATA / "listings.json").write_text(json.dumps(out, indent=1) + "\n")
    print(f"{len(listings)} listings from {len(rows)} usable of {len(r.json())} returned → {DATA / 'listings.json'}")


if __name__ == "__main__":
    main()
