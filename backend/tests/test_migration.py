"""Tests for the additive SQLite -> PostgreSQL copy helper.

Both sides use throwaway SQLite files so the test needs no external database,
while exercising the same ORM-level copy logic used for Supabase.
"""

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.security import hash_password
from app.models.base import Base
from app.models.chat import ChatMessage, ChatSession
from app.models.grievance import Grievance, GrievanceHistory
from app.models.knowledge import KnowledgeDocument
from app.models.service import Service
from app.models.user import User
from scripts.migrate_sqlite_to_postgres import copy_database


def _engine(path):
    return create_engine(
        f"sqlite:///{path}",
        connect_args={"check_same_thread": False},
    )


def _session(engine) -> Session:
    return sessionmaker(bind=engine, autoflush=False)()


def _seed_source(engine) -> None:
    Base.metadata.create_all(engine)
    with _session(engine) as db:
        db.add(
            User(
                id="user-source",
                email="citizen@example.com",
                full_name="Citizen One",
                phone="9999999999",
                password_hash=hash_password("Passw0rd!"),
                role="citizen",
                is_active=True,
            )
        )
        db.add(
            Service(
                id="service-source",
                name="Test Service",
                category="Testing",
                department="QA",
                description="A service used by tests.",
                eligibility="Everyone",
                required_documents=["ID proof"],
                procedure="Apply.",
                source_url="https://example.com",
                last_reviewed="2026-01-01",
                is_verified=True,
            )
        )
        db.add(
            KnowledgeDocument(
                id="doc-source",
                title="Test Document",
                content="A knowledge document used by tests.",
                category="Testing",
                last_reviewed="2026-01-01",
            )
        )
        db.add(
            Grievance(
                id="grievance-source",
                user_id="user-source",
                reference_number="GRV-20260101-TEST",
                subject="Street light",
                description="The light is out.",
                category="Municipal Services",
                location="Main Road",
                current_status="Submitted",
            )
        )
        db.add(
            GrievanceHistory(
                id="history-source",
                grievance_id="grievance-source",
                changed_by="user-source",
                old_status=None,
                new_status="Submitted",
                remarks="Lodged.",
            )
        )
        db.add(
            ChatSession(
                id="session-source",
                user_id="user-source",
                title="Public Service Inquiry",
            )
        )
        db.add(
            ChatMessage(
                id="message-source",
                session_id="session-source",
                role="user",
                content="How do I apply?",
                sources=[],
            )
        )
        db.commit()


def _count(engine, model) -> int:
    with _session(engine) as db:
        return db.scalar(select(func.count()).select_from(model)) or 0


def test_copy_is_additive_and_idempotent(tmp_path):
    source = _engine(tmp_path / "source.db")
    target = _engine(tmp_path / "target.db")
    Base.metadata.create_all(target)
    _seed_source(source)

    first = copy_database(source, target)
    assert first["users"] == {"inserted": 1, "skipped": 0}
    assert first["grievances"] == {"inserted": 1, "skipped": 0}
    assert first["chat_messages"] == {"inserted": 1, "skipped": 0}

    assert _count(target, User) == 1
    assert _count(target, Service) == 1
    assert _count(target, Grievance) == 1
    assert _count(target, GrievanceHistory) == 1
    assert _count(target, ChatSession) == 1
    assert _count(target, ChatMessage) == 1

    second = copy_database(source, target)
    assert all(table["inserted"] == 0 for table in second.values())
    assert second["users"]["skipped"] == 1
    assert _count(target, User) == 1


def test_dry_run_rolls_back(tmp_path):
    source = _engine(tmp_path / "source.db")
    target = _engine(tmp_path / "target.db")
    Base.metadata.create_all(target)
    _seed_source(source)

    stats = copy_database(source, target, dry_run=True)
    assert stats["users"]["inserted"] == 1
    assert _count(target, User) == 0
    assert _count(target, Grievance) == 0


def test_existing_email_is_reused_and_foreign_keys_remapped(tmp_path):
    source = _engine(tmp_path / "source.db")
    target = _engine(tmp_path / "target.db")
    Base.metadata.create_all(target)
    _seed_source(source)

    with _session(target) as db:
        db.add(
            User(
                id="user-target",
                email="citizen@example.com",
                full_name="Already Here",
                password_hash=hash_password("OtherPass1"),
                role="citizen",
                is_active=True,
            )
        )
        db.commit()

    stats = copy_database(source, target)
    assert stats["users"] == {"inserted": 0, "skipped": 1}

    with _session(target) as db:
        grievance = db.get(Grievance, "grievance-source")
        assert grievance is not None
        assert grievance.user_id == "user-target"

        history = db.get(GrievanceHistory, "history-source")
        assert history is not None
        assert history.changed_by == "user-target"

        chat = db.get(ChatSession, "session-source")
        assert chat is not None
        assert chat.user_id == "user-target"

    # The pre-existing account must not be overwritten.
    with _session(target) as db:
        user = db.get(User, "user-target")
        assert user.full_name == "Already Here"


def test_seeded_rows_are_not_duplicated(tmp_path):
    """A target seeded on first boot uses fresh UUIDs; match by name/title."""
    source = _engine(tmp_path / "source.db")
    target = _engine(tmp_path / "target.db")
    Base.metadata.create_all(target)
    _seed_source(source)

    with _session(target) as db:
        db.add(
            Service(
                id="service-target",
                name="Test Service",
                category="Already Seeded",
                department="Seed",
                description="Seeded on target boot.",
                eligibility="Everyone",
                required_documents=[],
                procedure="Existing.",
                last_reviewed="2026-01-01",
                is_verified=True,
            )
        )
        db.add(
            KnowledgeDocument(
                id="doc-target",
                title="Test Document",
                content="Seeded on target boot.",
                category="Already Seeded",
                last_reviewed="2026-01-01",
            )
        )
        db.commit()

    stats = copy_database(source, target)

    assert stats["services"] == {"inserted": 0, "skipped": 1}
    assert stats["knowledge_documents"] == {"inserted": 0, "skipped": 1}
    assert _count(target, Service) == 1
    assert _count(target, KnowledgeDocument) == 1

    with _session(target) as db:
        # The pre-existing seed row must win; it is never overwritten.
        assert db.get(Service, "service-target").category == "Already Seeded"
        assert db.get(KnowledgeDocument, "doc-target").content == "Seeded on target boot."


def test_same_source_and_target_is_rejected(tmp_path):
    engine = _engine(tmp_path / "same.db")
    Base.metadata.create_all(engine)
    with pytest.raises(ValueError):
        copy_database(engine, engine)


def test_health_endpoint_probes_database(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert body["database"] == "connected"
