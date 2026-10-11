#!/usr/bin/env python3
"""Explicitly research-only Yahoo Finance export. Not part of production ingestion.

The yfinance project states that downloaded Yahoo data is intended for personal use.
Do NOT use this command to seed the commercial ChartNova database or public APIs.
"""
import argparse
import csv
from datetime import date
import re
import sys

def main():
    parser = argparse.ArgumentParser(description="Research-only yfinance OHLC export to stdout.")
    parser.add_argument("--symbol", required=True, help="Yahoo Finance symbol, e.g. ^GSPC")
    parser.add_argument("--start", required=True, help="YYYY-MM-DD")
    parser.add_argument("--end", required=True, help="YYYY-MM-DD (exclusive)")
    parser.add_argument("--interval", choices=["1d", "1h"], default="1d")
    parser.add_argument("--acknowledge-research-only", action="store_true", required=True)
    args = parser.parse_args()
    if not args.acknowledge_research_only:
        parser.error("Must acknowledge research-only, personal-use limitations")
    if not re.fullmatch(r"[A-Za-z0-9^._=\-]{1,40}", args.symbol):
        parser.error("Invalid Yahoo ticker")
    try:
        start = date.fromisoformat(args.start)
        end = date.fromisoformat(args.end)
    except ValueError:
        parser.error("Dates must be valid YYYY-MM-DD")
    if end <= start:
        parser.error("End must be after start")
    try:
        import yfinance as yf
    except ImportError:
        parser.error("Research dependency missing: install yfinance in an isolated Python environment")

    frame = yf.Ticker(args.symbol).history(
        start=args.start, end=args.end, interval=args.interval,
        auto_adjust=False, actions=False,
    )
    if frame.empty:
        print("No vendor rows returned; nothing exported.", file=sys.stderr)
        return 2
    print(
        "RESEARCH ONLY — Yahoo Finance rights are not verified for "
        "ChartNova commercial storage or redistribution.", file=sys.stderr
    )
    csvout = csv.writer(sys.stdout)
    csvout.writerow(["source","rights","symbol","interval","source_timestamp","open","high","low","close","volume"])
    for stamp, row in frame.iterrows():
        if stamp.tzinfo is None:
            raise ValueError("Provider returned timezone-naive timestamp; cannot safely export")
        csvout.writerow([
            "yfinance","research_only",args.symbol,args.interval,
            stamp.isoformat(),row["Open"],row["High"],row["Low"],row["Close"],row.get("Volume", ""),
        ])
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
