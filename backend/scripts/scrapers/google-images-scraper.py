#!/usr/bin/env python3
"""
Image scraper for BillFlow YOLOv8 training data.
Uses icrawler with BingImageCrawler (Google parser is broken — Bing is stable).

Usage:
  pip install icrawler
  python scripts/scrapers/google-images-scraper.py --industry=JEWELRY --count=50
  python scripts/scrapers/google-images-scraper.py --all --count=50
"""

import argparse
import csv
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

try:
    from icrawler.builtin import BingImageCrawler
except ImportError:
    print("ERROR: icrawler not installed. Run: pip install icrawler")
    sys.exit(1)

# ── Config ─────────────────────────────────────────────────────

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", os.path.join(os.getcwd(), "uploads"))

INDUSTRY_QUERIES: dict[str, list[str]] = {
    "JEWELRY": [
        "gold necklace india",
        "silver jewelry india",
        "gold ring india",
        "diamond ring india",
        "silver payal india",
    ],
    "HARDWARE": [
        "hammer tool india",
        "screwdriver set india",
        "drill machine india",
        "pipe fitting india",
    ],
    "ELECTRICAL": [
        "LED bulb india",
        "modular switch india",
        "MCB circuit breaker india",
        "ceiling fan india",
    ],
    "APPAREL": [
        "cotton kurta india",
        "saree india",
        "jeans india",
        "t-shirt india",
    ],
    "FOOTWEAR": [
        "leather shoe india",
        "sandal india",
        "sports shoe india",
        "chappal india",
    ],
    "ELECTRONICS": [
        "smartphone india",
        "laptop india",
        "earbuds india",
        "smartwatch india",
    ],
    "BAKERY": [
        "bread loaf india",
        "cake india",
        "biscuit packet india",
        "namkeen india",
    ],
    "TOYS": [
        "toy car india",
        "doll india",
        "puzzle india",
        "building blocks india",
    ],
}


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def scrape_industry(industry: str, queries: list[str], count: int) -> None:
    industry_dir = Path(UPLOAD_DIR) / "training" / industry.lower()
    manifest_path = industry_dir / "manifest.csv"
    industry_dir.mkdir(parents=True, exist_ok=True)

    # Append mode for manifest
    write_header = not manifest_path.exists()
    manifest_file = open(manifest_path, "a", newline="", encoding="utf-8")
    writer = csv.DictWriter(
        manifest_file, fieldnames=["query", "filename", "directory", "timestamp"]
    )
    if write_header:
        writer.writeheader()

    print(f"\n=== {industry} ({len(queries)} queries × {count} images) ===")

    for query in queries:
        slug = slugify(query)
        dest_dir = industry_dir / slug
        dest_dir.mkdir(parents=True, exist_ok=True)

        # Count already-downloaded images to skip if done
        existing = list(dest_dir.glob("*.jpg")) + list(dest_dir.glob("*.png"))
        if len(existing) >= count:
            print(f"  SKIP '{query}' — {len(existing)} images already downloaded")
            continue

        print(f"  Downloading: '{query}' → {dest_dir}")

        try:
            crawler = BingImageCrawler(
                storage={"root_dir": str(dest_dir)},
                # Suppress internal logs
                log_level=50,
            )
            crawler.crawl(
                keyword=query,
                max_num=count,
                min_size=(100, 100),  # Skip tiny thumbnails
                file_idx_offset="auto",
            )
        except Exception as e:
            print(f"  ERROR crawling '{query}': {e}")
            time.sleep(2)
            continue

        # Record in manifest
        downloaded = list(dest_dir.glob("*.jpg")) + list(dest_dir.glob("*.png"))
        for f in downloaded:
            writer.writerow({
                "query":     query,
                "filename":  f.name,
                "directory": str(dest_dir.relative_to(UPLOAD_DIR)),
                "timestamp": datetime.utcnow().isoformat(),
            })
        manifest_file.flush()

        print(f"    → {len(downloaded)} images saved")
        # Polite delay between queries
        time.sleep(1.5)

    manifest_file.close()
    print(f"\n  Manifest: {manifest_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Download Google Images for BillFlow YOLOv8 training"
    )
    parser.add_argument(
        "--industry",
        choices=list(INDUSTRY_QUERIES.keys()),
        help="Single industry to scrape",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Scrape all industries",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=50,
        help="Images per query (default: 50)",
    )
    args = parser.parse_args()

    if not args.industry and not args.all:
        parser.error("Specify --industry=NAME or --all")

    targets = (
        INDUSTRY_QUERIES
        if args.all
        else {args.industry: INDUSTRY_QUERIES[args.industry]}
    )

    print(f"UPLOAD_DIR: {UPLOAD_DIR}")
    print(f"Industries: {list(targets.keys())}")
    print(f"Images/query: {args.count}")

    for industry, queries in targets.items():
        scrape_industry(industry, queries, args.count)

    print("\nAll done. Next: import images into Label Studio for annotation.")


if __name__ == "__main__":
    main()
