#!/usr/bin/env python3
"""Isolated, read-only CPSC API proof for an ephemeral GitHub-hosted runner.

No credentials, browser, third-party libraries, Git operations, or publishing.
Report transport success separately from data quality. Output contains a small
public-data sample and hashes, never a claim that a product is safe or recalled.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request

API = "https://www.saferproducts.gov/RestWebServices/Recall"
API_HOST = "www.saferproducts.gov"
API_PATH = "/RestWebServices/Recall"
MAX_BYTES = 4 * 1024 * 1024
MAX_ROWS = 1000
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
UA = "BCServiceDataFactory-ReadOnlyPrototype/0.4 (public CPSC recall metadata)"


def parse_day(value: str) -> dt.date:
    if not DATE_PATTERN.fullmatch(value):
        raise ValueError("Date must be YYYY-MM-DD")
    return dt.date.fromisoformat(value)


def date_from_api(value: object) -> str | None:
    if not isinstance(value, str) or len(value) < 10:
        return None
    try:
        return parse_day(value[:10]).isoformat()
    except ValueError:
        return None


def safe_text(value: object, maximum: int = 160) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.split())[:maximum]


def official_url(value: object) -> bool:
    if not isinstance(value, str):
        return False
    try:
        parsed = urllib.parse.urlsplit(value)
        return (
            parsed.scheme == "https" and
            parsed.hostname in ("cpsc.gov", "www.cpsc.gov") and
            parsed.username is None and parsed.password is None and
            parsed.port is None and
            parsed.path.lower().startswith("/recalls/")
        )
    except ValueError:
        return False


def endpoint(start: dt.date, end: dt.date) -> str:
    if start > end or (end - start).days > 30:
        raise ValueError("Probe window must be 1-31 days")
    return API + "?" + urllib.parse.urlencode({
        "format": "json",
        "LastPublishDateStart": start.isoformat(),
        "LastPublishDateEnd": end.isoformat(),
    })


class OfficialOnlyRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        dest = urllib.parse.urlsplit(newurl)
        if (dest.scheme != "https" or dest.hostname != API_HOST or
                dest.path.lower() != API_PATH.lower() or
                dest.username or dest.password or dest.port):
            raise ValueError("CPSC API redirect outside approved endpoint")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch_live(url: str, timeout: int = 20) -> tuple[bytes, dict]:
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or parsed.hostname != API_HOST or parsed.path != API_PATH:
        raise ValueError("Only the fixed official CPSC API URL is permitted")
    opener = urllib.request.build_opener(
        urllib.request.HTTPSHandler(context=ssl.create_default_context()),
        OfficialOnlyRedirect(),
    )
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": UA})
    with opener.open(req, timeout=timeout) as response:
        location = urllib.parse.urlsplit(response.geturl())
        if location.scheme != "https" or location.hostname != API_HOST or location.path.lower() != API_PATH.lower():
            raise ValueError("Unexpected final response address")
        status = response.status
        content_type = response.headers.get("Content-Type", "")
        raw = response.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            raise ValueError("Response exceeds 4 MiB probe limit")
        if status != 200:
            raise ValueError(f"HTTP status {status}")
    return raw, {"http_status": status, "content_type": content_type,
                 "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest(),
                 "final_host": location.hostname}


def inspect(raw: bytes, start: dt.date, end: dt.date) -> tuple[dict, list[dict]]:
    try:
        records = json.loads(raw.decode("utf-8-sig"))
    except (ValueError, UnicodeDecodeError) as exc:
        raise ValueError("API response is not valid UTF-8 JSON") from exc
    if not isinstance(records, list):
        raise ValueError("Expected top-level JSON array")
    if len(records) > MAX_ROWS:
        raise ValueError("Unexpected number of records in 31-day window")
    issues = []
    sample = []
    ids = []
    missing_model = 0
    for index, item in enumerate(records):
        if not isinstance(item, dict):
            issues.append(f"item_{index}_not_object")
            continue
        rid = item.get("RecallID")
        if not isinstance(rid, int) or isinstance(rid, bool) or rid <= 0:
            issues.append(f"item_{index}_invalid_recall_id")
        else:
            ids.append(rid)
        date = date_from_api(item.get("LastPublishDate"))
        if date is None or not (start <= parse_day(date) <= end):
            issues.append(f"item_{index}_date_outside_window_or_missing")
        src = item.get("URL")
        if not official_url(src):
            issues.append(f"item_{index}_unverified_source_url")
        products = item.get("Products")
        if not isinstance(products, list):
            issues.append(f"item_{index}_missing_products")
            products = []
        models = [safe_text(x.get("Model"), 90) for x in products if isinstance(x, dict) and x.get("Model")]
        if not models:
            missing_model += 1
        if index < 10:
            sample.append({
                "recall_id": rid if isinstance(rid, int) and not isinstance(rid, bool) else None,
                "recall_number": safe_text(item.get("RecallNumber"), 40),
                "last_publish_date": date,
                "title": safe_text(item.get("Title"), 160),
                "source_url": src if official_url(src) else None,
                "product_names": [safe_text(x.get("Name"), 95) for x in products[:8] if isinstance(x, dict)],
                "models_in_explicit_field": models[:8],
                "review_status": "unreviewed",
                "automatic_inventory_matching": False,
            })
    if len(set(ids)) != len(ids):
        issues.append("duplicate_recall_ids")
    if not records:
        issues.append("zero_records_first_live_probe_requires_review")
    return {
        "record_count": len(records), "unique_valid_recall_ids": len(set(ids)),
        "missing_explicit_model_count": missing_model,
        "issue_count": len(issues), "issues": issues[:50],
        "issues_truncated": len(issues) > 50,
        "all_records_review_only": True,
        "quality_status": "PASS" if not issues else "REVIEW_REQUIRED",
    }, sample


def run(start: dt.date, end: dt.date, output: Path, transport=fetch_live) -> dict:
    output.mkdir(parents=True, exist_ok=True)
    fetched_at = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    result = {
        "schema_version": 1,
        "run_at_utc": fetched_at,
        "request_host": API_HOST,
        "window_start": start.isoformat(),
        "window_end": end.isoformat(),
        "transport_status": "NOT_FETCHED",
        "quality_status": "NOT_VERIFIED",
        "inventory_matching_enabled": False,
        "project_files_changed": False,
        "source": "https://www.cpsc.gov/Recalls/CPSC-Recalls-Application-Program-Interface-API-Information",
    }
    sample = []
    try:
        url = endpoint(start, end)
        raw, meta = transport(url)
        result.update(meta)
        result["transport_status"] = "HTTP_OK"
        quality, sample = inspect(raw, start, end)
        result.update(quality)
    except Exception as exc:
        result["error_type"] = type(exc).__name__
        result["error_detail"] = safe_text(str(exc), 240)
    (output / "probe_report.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    (output / "sample_review_only.json").write_text(
        json.dumps({"source": "CPSC", "review_only": True, "records": sample}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return result


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--output", default="output")
    p.add_argument("--days", type=int, default=14)
    p.add_argument("--start")
    p.add_argument("--end")
    p.add_argument("--timeout", type=int, default=20)
    a = p.parse_args()
    today = dt.datetime.now(dt.timezone.utc).date()
    if not 1 <= a.days <= 31 or not 2 <= a.timeout <= 60:
        p.error("days must be 1-31 and timeout 2-60 seconds")
    start = parse_day(a.start) if a.start else today - dt.timedelta(days=a.days - 1)
    end = parse_day(a.end) if a.end else today
    if end > today + dt.timedelta(days=1):
        p.error("end cannot be in the distant future")
    result = run(start, end, Path(a.output), lambda url: fetch_live(url, a.timeout))
    print(json.dumps({k: result.get(k) for k in (
        "transport_status", "quality_status", "record_count", "unique_valid_recall_ids",
        "window_start", "window_end", "sha256", "error_type", "error_detail"
    )}, ensure_ascii=False))
    return 0 if result.get("transport_status") == "HTTP_OK" and result.get("quality_status") == "PASS" else 3


if __name__ == "__main__":
    sys.exit(main())
