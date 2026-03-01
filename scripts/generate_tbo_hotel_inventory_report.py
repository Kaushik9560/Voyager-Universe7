#!/usr/bin/env python3
"""
Generate a shareable TBO Hotel Inventory coverage report by Indian state/UT.

Output:
  - reports/tbo-hotel-inventory-report-<timestamp>.json
  - reports/tbo-hotel-inventory-report-<timestamp>.md

It uses:
  CityList -> TBOHotelCodeList -> Search
for each canonical India state/UT mapped to a major city.
"""

from __future__ import annotations

import argparse
import base64
import datetime as dt
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


CANONICAL_IN_STATES: Dict[str, Dict[str, Any]] = {
    "Andhra Pradesh": {"city": "Visakhapatnam", "stateTokens": ["andhra", "pradesh"]},
    "Arunachal Pradesh": {"city": "Itanagar", "stateTokens": ["arunachal", "pradesh"]},
    "Assam": {"city": "Guwahati", "stateTokens": ["assam"]},
    "Bihar": {"city": "Patna", "stateTokens": ["bihar"]},
    "Chhattisgarh": {"city": "Raipur", "stateTokens": ["chhattisgarh"]},
    "Goa": {"city": "Goa", "stateTokens": ["goa"]},
    "Gujarat": {"city": "Ahmedabad", "stateTokens": ["gujarat"]},
    "Haryana": {"city": "Gurgaon", "stateTokens": ["haryana"]},
    "Himachal Pradesh": {"city": "Shimla", "stateTokens": ["himachal", "pradesh"]},
    "Jharkhand": {"city": "Ranchi", "stateTokens": ["jharkhand"]},
    "Karnataka": {"city": "Bangalore", "stateTokens": ["karnataka"]},
    "Kerala": {"city": "Kochi", "stateTokens": ["kerala"]},
    "Madhya Pradesh": {"city": "Indore", "stateTokens": ["madhya", "pradesh"]},
    "Maharashtra": {"city": "Mumbai", "stateTokens": ["maharashtra"]},
    "Manipur": {"city": "Imphal", "stateTokens": ["manipur"]},
    "Meghalaya": {"city": "Shillong", "stateTokens": ["meghalaya"]},
    "Mizoram": {"city": "Aizawl", "stateTokens": ["mizoram"]},
    "Nagaland": {"city": "Kohima", "stateTokens": ["nagaland"]},
    "Odisha": {"city": "Bhubaneswar", "stateTokens": ["odisha"]},
    "Punjab": {"city": "Amritsar", "stateTokens": ["punjab"]},
    "Rajasthan": {"city": "Jaipur", "stateTokens": ["rajasthan"]},
    "Sikkim": {"city": "Gangtok", "stateTokens": ["sikkim"]},
    "Tamil Nadu": {"city": "Chennai", "stateTokens": ["tamil", "nadu"]},
    "Telangana": {"city": "Hyderabad", "stateTokens": ["telangana"]},
    "Tripura": {"city": "Agartala", "stateTokens": ["tripura"]},
    "Uttar Pradesh": {"city": "Lucknow", "stateTokens": ["uttar", "pradesh"]},
    "Uttarakhand": {"city": "Dehradun", "stateTokens": ["uttarakhand"]},
    "West Bengal": {"city": "Kolkata", "stateTokens": ["west", "bengal"]},
    "Andaman and Nicobar Islands": {"city": "Port Blair", "stateTokens": ["andaman", "nicobar"]},
    "Chandigarh": {"city": "Chandigarh", "stateTokens": ["chandigarh"]},
    "Dadra and Nagar Haveli and Daman and Diu": {"city": "Daman", "stateTokens": ["daman"]},
    "Delhi": {"city": "New Delhi", "stateTokens": ["delhi"]},
    "Jammu and Kashmir": {"city": "Srinagar", "stateTokens": ["jammu", "kashmir"]},
    "Ladakh": {"city": "Leh", "stateTokens": ["ladakh"]},
    "Lakshadweep": {"city": "Kavaratti", "stateTokens": ["lakshadweep"]},
    "Puducherry": {"city": "Puducherry", "stateTokens": ["puducherry"]},
}


def norm_tokens(text: str) -> List[str]:
    return [t for t in re.sub(r"[^a-z0-9]+", " ", text.lower()).split() if t]


def has_all_tokens(text: str, tokens: List[str]) -> bool:
    hay = " ".join(norm_tokens(text))
    return all(tok in hay for tok in tokens)


def read_env(path: Path) -> Dict[str, str]:
    data: Dict[str, str] = {}
    for line in path.read_text().splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        data[k.strip()] = v.strip().strip('"').strip("'")
    return data


@dataclass
class TBOClient:
    base_url: str
    auth_header: str
    timeout_seconds: int = 15

    def post(self, path: str, payload: Dict[str, Any], timeout: Optional[int] = None) -> Dict[str, Any]:
        req = Request(
            f"{self.base_url}/{path}",
            data=json.dumps(payload).encode(),
            headers={
                "Content-Type": "application/json",
                "Authorization": self.auth_header,
            },
            method="POST",
        )
        t = timeout if timeout is not None else self.timeout_seconds
        try:
            with urlopen(req, timeout=t) as res:
                raw = res.read().decode("utf-8", "replace")
                return json.loads(raw) if raw else {}
        except HTTPError as err:
            body = err.read().decode("utf-8", "replace")
            return {"_httpError": err.code, "_body": body}
        except URLError as err:
            return {"_urlError": str(err)}
        except Exception as err:  # pragma: no cover
            return {"_error": str(err)}


def pick_city_for_state(city_rows: List[Dict[str, Any]], preferred_city: str, state_tokens: List[str]) -> Optional[Dict[str, str]]:
    city_tokens = norm_tokens(preferred_city)
    strict: List[Dict[str, Any]] = []
    soft: List[Dict[str, Any]] = []

    for row in city_rows:
        name = str(row.get("Name") or row.get("CityName") or "").strip()
        code = row.get("Code", row.get("CityCode"))
        if not name or code in (None, ""):
            continue
        if has_all_tokens(name, city_tokens):
            soft.append(row)
            if has_all_tokens(name, state_tokens):
                strict.append(row)

    candidates = strict or soft
    if not candidates:
        return None
    candidates.sort(key=lambda r: len(str(r.get("Name") or r.get("CityName") or "")))
    chosen = candidates[0]
    return {
        "cityName": str(chosen.get("Name") or chosen.get("CityName") or preferred_city).strip(),
        "cityCode": str(chosen.get("Code", chosen.get("CityCode"))),
    }


def extract_hotel_codes(hotel_code_list_resp: Dict[str, Any], limit: int = 12) -> List[str]:
    out: List[str] = []
    for row in (hotel_code_list_resp.get("Hotels") or [])[:limit]:
        code = str(row.get("HotelCode", "")).strip()
        if code:
            out.append(code)
    if out:
        return out

    for row in (hotel_code_list_resp.get("HotelCodes") or [])[:limit]:
        if isinstance(row, (str, int)):
            code = str(row).strip()
        else:
            code = str((row or {}).get("HotelCode", "")).strip()
        if code:
            out.append(code)
    return out


def run_scan(
    client: TBOClient,
    country_code: str,
    windows: List[int],
    response_time: int,
    max_workers: int = 8,
) -> Dict[str, Any]:
    city_list = client.post("CityList", {"CountryCode": country_code}, timeout=25)
    city_status = (city_list.get("Status") or {}).get("Code")
    if city_status != 200:
        raise RuntimeError(f"CityList failed: {json.dumps(city_list.get('Status') or city_list)}")

    city_rows = city_list.get("CityList") or []
    today = dt.date.today()

    def scan_one_state(state: str, meta: Dict[str, Any]) -> Dict[str, Any]:
        preferred_city = str(meta["city"])
        state_tokens = list(meta["stateTokens"])
        picked = pick_city_for_state(city_rows, preferred_city, state_tokens)
        if not picked:
            return {
                "state": state,
                "preferredCity": preferred_city,
                "cityNameUsed": preferred_city,
                "cityCode": None,
                "maxInventoryCount": 0,
                "note": "City not found in CityList",
                "attempts": [],
            }

        city_name_used = picked["cityName"]
        city_code = picked["cityCode"]
        code_list_resp = client.post(
            "TBOHotelCodeList",
            {
                "CityCode": int(city_code) if city_code.isdigit() else city_code,
                "IsDetailedResponse": False,
            },
            timeout=20,
        )
        code_list_status = code_list_resp.get("Status") or {}
        if code_list_status.get("Code") != 200:
            return {
                "state": state,
                "preferredCity": preferred_city,
                "cityNameUsed": city_name_used,
                "cityCode": city_code,
                "maxInventoryCount": 0,
                "note": "TBOHotelCodeList did not return success",
                "hotelCodeListStatus": code_list_status,
                "attempts": [],
            }

        hotel_codes = extract_hotel_codes(code_list_resp, limit=12)
        if not hotel_codes:
            return {
                "state": state,
                "preferredCity": preferred_city,
                "cityNameUsed": city_name_used,
                "cityCode": city_code,
                "maxInventoryCount": 0,
                "note": "No hotel codes in TBOHotelCodeList response",
                "hotelCodeListStatus": code_list_status,
                "attempts": [],
            }

        attempts: List[Dict[str, Any]] = []
        max_count = 0
        best_attempt: Optional[Dict[str, Any]] = None

        for offset in windows:
            check_in = today + dt.timedelta(days=offset)
            check_out = check_in + dt.timedelta(days=3)
            payload = {
                "CheckIn": check_in.isoformat(),
                "CheckOut": check_out.isoformat(),
                "HotelCodes": ",".join(hotel_codes),
                "GuestNationality": "IN",
                "PaxRooms": [{"Adults": 2, "Children": 0, "ChildrenAges": []}],
                "ResponseTime": response_time,
                "IsDetailedResponse": False,
                "Filters": {"Refundable": False, "NoOfRooms": 0, "MealType": "All"},
            }
            search_resp = client.post("Search", payload, timeout=25)
            status = search_resp.get("Status") or {}
            code = status.get("Code")
            results_count = len(((search_resp.get("HotelSearchResult") or {}).get("HotelResults") or []))
            attempts.append(
                {
                    "checkIn": check_in.isoformat(),
                    "checkOut": check_out.isoformat(),
                    "status": status,
                    "inventoryCount": results_count if code == 200 else 0,
                }
            )
            if code == 200 and results_count > max_count:
                max_count = results_count
                best_attempt = attempts[-1]

        return {
            "state": state,
            "preferredCity": preferred_city,
            "cityNameUsed": city_name_used,
            "cityCode": city_code,
            "hotelCodesSample": hotel_codes,
            "maxInventoryCount": max_count,
            "bestAttempt": best_attempt,
            "attempts": attempts,
        }

    results: List[Dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = [pool.submit(scan_one_state, state, meta) for state, meta in CANONICAL_IN_STATES.items()]
        for future in as_completed(futures):
            results.append(future.result())
    results.sort(key=lambda r: str(r.get("state", "")).lower())

    non_empty = [r for r in results if int(r.get("maxInventoryCount", 0)) > 0]
    return {
        "summary": {
            "countryCode": country_code,
            "statesTargeted": len(CANONICAL_IN_STATES),
            "statesScanned": len(results),
            "statesWithNonEmptyInventory": len(non_empty),
            "statesWithOnlyEmptyInventory": len(results) - len(non_empty),
            "windowsDaysFromToday": windows,
            "nightsPerSearch": 3,
            "searchResponseTime": response_time,
            "maxWorkers": max_workers,
            "scanDateUTC": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        },
        "nonEmptyStates": non_empty,
        "allStates": results,
    }


def to_markdown(report: Dict[str, Any], base_url: str, username: str) -> str:
    summary = report["summary"]
    non_empty = report["nonEmptyStates"]
    lines: List[str] = []
    lines.append("# TBO Hotel Inventory State-Wise Scan Report")
    lines.append("")
    lines.append("## Scan Metadata")
    lines.append(f"- Scan time (UTC): {summary['scanDateUTC']}")
    lines.append(f"- Country code: `{summary['countryCode']}`")
    lines.append(f"- Base URL: `{base_url}`")
    lines.append(f"- Username used: `{username}`")
    lines.append("- Password used: `[redacted]`")
    lines.append(f"- States/UT targeted: **{summary['statesTargeted']}**")
    lines.append(f"- Search windows (days from scan date): `{summary['windowsDaysFromToday']}`")
    lines.append(f"- Nights per search: `{summary['nightsPerSearch']}`")
    lines.append("")
    lines.append("## Outcome")
    lines.append(f"- States with non-empty live inventory: **{summary['statesWithNonEmptyInventory']}**")
    lines.append(f"- States with empty inventory only: **{summary['statesWithOnlyEmptyInventory']}**")
    lines.append("")
    if non_empty:
        lines.append("### Non-Empty States")
        for row in non_empty:
            lines.append(
                f"- {row['state']} ({row['cityNameUsed']}) -> count `{row['maxInventoryCount']}` on "
                f"{(row.get('bestAttempt') or {}).get('checkIn', 'n/a')}"
            )
    else:
        lines.append("### Non-Empty States")
        lines.append("- None (all scanned states returned empty inventory for tested windows).")

    lines.append("")
    lines.append("## Interpretation")
    lines.append(
        "- Credentials and static-data calls can still work while `Search` returns empty inventory. "
        "This usually indicates entitlement/contracting/rate availability constraints at supplier/account level."
    )
    lines.append("")
    lines.append("## Machine-Readable Details")
    lines.append("- Full per-state attempts are available in the paired JSON file.")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-file", default=".env.local")
    parser.add_argument("--out-dir", default="reports")
    parser.add_argument("--country", default=None)
    parser.add_argument("--windows", default="7,30,60", help="Comma-separated day offsets, e.g. 7,30,60")
    parser.add_argument("--response-time", default="12")
    parser.add_argument("--max-workers", default="10")
    args = parser.parse_args()

    env_path = Path(args.env_file)
    if not env_path.exists():
        print(f"Env file not found: {env_path}", file=sys.stderr)
        return 1

    env = read_env(env_path)
    base_url = (env.get("TBO_HOTEL_BASE_URL") or "http://api.tbotechnology.in/TBOHolidays_HotelAPI").rstrip("/")
    username = env.get("TBO_HOTEL_USERNAME") or env.get("TBO_USERNAME") or ""
    password = env.get("TBO_HOTEL_PASSWORD") or env.get("TBO_PASSWORD") or ""
    country = args.country or env.get("TBO_HOTEL_COUNTRY_CODE") or "IN"

    if not username or not password:
        print("Missing TBO hotel credentials in env file.", file=sys.stderr)
        return 1

    windows = [int(x.strip()) for x in args.windows.split(",") if x.strip()]
    response_time = int(args.response_time)
    max_workers = max(1, int(args.max_workers))
    auth_header = "Basic " + base64.b64encode(f"{username}:{password}".encode()).decode()
    client = TBOClient(base_url=base_url, auth_header=auth_header, timeout_seconds=15)

    try:
        report = run_scan(client, country, windows, response_time, max_workers=max_workers)
    except Exception as err:
        print(f"Scan failed: {err}", file=sys.stderr)
        return 2

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    ts = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    json_path = out_dir / f"tbo-hotel-inventory-report-{ts}.json"
    md_path = out_dir / f"tbo-hotel-inventory-report-{ts}.md"

    json_path.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    md_path.write_text(to_markdown(report, base_url=base_url, username=username))

    print(json.dumps({"json": str(json_path), "markdown": str(md_path), "summary": report["summary"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
