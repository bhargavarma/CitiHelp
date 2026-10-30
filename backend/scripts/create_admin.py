"""Create the bootstrap administrator account if it does not already exist.

Usage (from the backend directory):
    .venv/Scripts/python.exe -m scripts.create_admin --email admin@example.gov.in --password "StrongPass123"

If --email / --password are omitted, ADMIN_BOOTSTRAP_EMAIL and
ADMIN_BOOTSTRAP_PASSWORD from the environment are used.

Safety: an existing administrator is preserved without resetting its password,
and an existing citizen account is never promoted.
"""

import argparse
import logging
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings  # noqa: E402
from app.database.seed import seed_admin_user  # noqa: E402
from app.database.session import SessionLocal  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create the bootstrap administrator if it does not already exist"
    )
    parser.add_argument("--email", default=settings.ADMIN_BOOTSTRAP_EMAIL)
    parser.add_argument("--password", default=settings.ADMIN_BOOTSTRAP_PASSWORD)
    parser.add_argument("--name", default=settings.ADMIN_BOOTSTRAP_NAME)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.email or not args.password:
        raise SystemExit(
            "Administrator credentials are required. Pass --email and --password "
            "or set ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD."
        )

    with SessionLocal() as db:
        admin = seed_admin_user(db, args.email, args.password, args.name)
        db.commit()
        if admin is None:
            raise SystemExit("Administrator account was not created.")
        admin_email = admin.email
        admin_role = admin.role

    print(f"Administrator ready: {admin_email} (role={admin_role})")


if __name__ == "__main__":
    main()
