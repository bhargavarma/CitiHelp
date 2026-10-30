"""Seed the public service directory and curated knowledge documents.

Usage (from the backend directory):
    .venv/Scripts/python.exe -m scripts.seed_data
"""

import logging
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database.seed import seed_reference_data  # noqa: E402
from app.database.session import SessionLocal  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")


def main() -> None:
    with SessionLocal() as db:
        seed_reference_data(db)
        db.commit()
    print("Reference data seeded (services and knowledge documents).")


if __name__ == "__main__":
    main()
