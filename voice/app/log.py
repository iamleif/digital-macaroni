"""
Structured, content-free logs for Cloud Logging. Never pass audio, transcripts, names, addresses,
phone numbers or tool inputs here: only event names, ids, counts and timings.
"""

import json
import sys
from typing import Any

Fields = dict[str, str | int | float | bool | None]


def _write(severity: str, event: str, fields: Fields | None, err: BaseException | None = None) -> None:
    record: dict[str, Any] = {"severity": severity, "event": event, **(fields or {})}
    if err is not None:
        record["error"] = f"{type(err).__name__}: {err}"[:300]
    print(json.dumps(record), file=sys.stdout, flush=True)


def info(event: str, fields: Fields | None = None) -> None:
    _write("INFO", event, fields)


def warn(event: str, fields: Fields | None = None, err: BaseException | None = None) -> None:
    _write("WARNING", event, fields, err)


def error(event: str, fields: Fields | None = None, err: BaseException | None = None) -> None:
    _write("ERROR", event, fields, err)
