#!/usr/bin/env python3
"""
Import auto-labels into Label Studio via API.

Pre-requisite:
  1. Start Label Studio: docker compose -f docker-compose.label-studio.yml up -d
  2. Create a project with Object Detection bounding-box template
  3. Run auto_label.py --all --review  (generates auto_labels_import.json)
  4. Get API token: Label Studio → Account & Settings → Access Token

Usage:
  python scripts/training/import_to_label_studio.py \
    --url=http://localhost:8080 \
    --token=<api_token> \
    --project-id=<id>

Find project ID: open the project in browser — URL is /projects/{id}/
"""

import argparse
import json
import os
import sys
from pathlib import Path

import urllib.request
import urllib.error

try:
    from tqdm import tqdm
except ImportError:
    print("ERROR: tqdm not installed. Run: pip install tqdm")
    sys.exit(1)

UPLOAD_DIR   = os.environ.get("UPLOAD_DIR", os.path.join(os.getcwd(), "uploads"))
IMPORT_JSON  = Path(UPLOAD_DIR) / "training" / "auto_labels_import.json"
CHUNK_SIZE   = 100   # tasks per API call — LS handles up to 250 but 100 is safe


# ── API helpers ────────────────────────────────────────────────

def api_request(url: str, token: str, data: bytes, method: str = "POST") -> tuple[int, dict]:
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Token {token}",
            "Content-Type":  "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode())
            return resp.status, body
    except urllib.error.HTTPError as e:
        body = {}
        try:
            body = json.loads(e.read().decode())
        except Exception:
            pass
        return e.code, body


def check_project(base_url: str, token: str, project_id: int) -> str:
    """Verify project exists. Returns project title."""
    status, body = api_request(
        f"{base_url}/api/projects/{project_id}/",
        token, b"", method="GET"
    )
    if status == 200:
        return body.get("title", f"Project {project_id}")
    if status == 401:
        print("ERROR: Invalid API token.")
        sys.exit(1)
    if status == 404:
        print(f"ERROR: Project {project_id} not found.")
        sys.exit(1)
    print(f"ERROR: API returned {status}: {body}")
    sys.exit(1)


# ── Task conversion ────────────────────────────────────────────

def annotation_to_prediction(task: dict) -> dict:
    """
    Convert auto_labels_import.json task to Label Studio import format.
    Uses 'predictions' (not 'annotations') so auto-labels appear as
    model suggestions for human review — not as ground truth.
    """
    annotations = task.get("annotations", [])
    results = []
    if annotations:
        results = annotations[0].get("result", [])

    return {
        "data": task["data"],
        "predictions": [
            {
                "model_version": "yolov8n-coco-autolabel",
                "score": 0.5,   # placeholder confidence
                "result": results,
            }
        ] if results else [],
    }


# ── Main ───────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import auto-labels into Label Studio"
    )
    parser.add_argument("--url",        default="http://localhost:8080",
                        help="Label Studio base URL (default: http://localhost:8080)")
    parser.add_argument("--token",      required=True,
                        help="API token from Account & Settings → Access Token")
    parser.add_argument("--project-id", required=True, type=int,
                        help="Label Studio project ID (from URL: /projects/{id}/)")
    parser.add_argument("--input",      default=str(IMPORT_JSON),
                        help=f"Path to auto_labels_import.json (default: {IMPORT_JSON})")
    args = parser.parse_args()

    base_url   = args.url.rstrip("/")
    token      = args.token
    project_id = args.project_id
    input_path = Path(args.input)

    # Validate input file
    if not input_path.exists():
        print(f"ERROR: {input_path} not found.")
        print("Run first: python scripts/training/auto_label.py --all --review")
        sys.exit(1)

    # Validate project
    print(f"Connecting to {base_url}...")
    title = check_project(base_url, token, project_id)
    print(f"Project #{project_id}: {title}")

    # Load tasks
    print(f"\nReading {input_path}...")
    tasks_raw: list[dict] = json.loads(input_path.read_text())
    print(f"Tasks in file: {len(tasks_raw)}")

    if not tasks_raw:
        print("No tasks to import.")
        sys.exit(0)

    # Convert annotations → predictions (for review mode)
    tasks = [annotation_to_prediction(t) for t in tasks_raw]

    # Chunk + import
    import_url = f"{base_url}/api/projects/{project_id}/import"
    total      = len(tasks)
    imported   = 0
    failed     = 0
    chunks     = [tasks[i:i + CHUNK_SIZE] for i in range(0, total, CHUNK_SIZE)]

    print(f"Importing {total} tasks in {len(chunks)} chunks of {CHUNK_SIZE}...\n")

    for chunk in tqdm(chunks, desc="Importing", unit="chunk"):
        payload = json.dumps(chunk).encode()
        status, body = api_request(import_url, token, payload)

        if status in (200, 201):
            count = body.get("task_count", len(chunk))
            imported += count
        else:
            failed += len(chunk)
            tqdm.write(f"  Chunk failed ({status}): {body.get('detail') or body}")

    print(f"""
Summary
-------
Total tasks:   {total}
Imported:      {imported}
Failed:        {failed}

Next steps:
  1. Open Label Studio: {base_url}/projects/{project_id}/
  2. Tasks appear with auto-label predictions (yellow boxes)
  3. Review each task: accept / adjust / reject bounding boxes
  4. Mark task as complete → it becomes ground truth annotation
  5. When done: Export → YOLO format → extract to backend/datasets/billflow/labels/
""")


if __name__ == "__main__":
    main()
