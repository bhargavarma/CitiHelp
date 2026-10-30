"""Initial schema for the Public Grievance AI Assistant.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-10-31
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

GRIEVANCE_STATUSES = "'Submitted', 'Under Review', 'In Progress', 'Resolved', 'Rejected'"
NOW = sa.text("CURRENT_TIMESTAMP")


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("password_hash", sa.String(length=512), nullable=False),
        sa.Column("role", sa.String(length=20), server_default="citizen", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        *_timestamps(),
        sa.CheckConstraint("role IN ('citizen', 'admin')", name="ck_users_role"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_role", "users", ["role"], unique=False)

    op.create_table(
        "services",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("department", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("eligibility", sa.Text(), nullable=False),
        sa.Column("required_documents", sa.JSON(), nullable=False),
        sa.Column("procedure", sa.Text(), nullable=False),
        sa.Column("source_url", sa.String(length=500), nullable=True),
        sa.Column("last_reviewed", sa.String(length=50), nullable=False),
        sa.Column("is_verified", sa.Boolean(), server_default=sa.false(), nullable=False),
        *_timestamps(),
    )
    op.create_index("ix_services_name", "services", ["name"], unique=False)
    op.create_index("ix_services_category", "services", ["category"], unique=False)

    op.create_table(
        "grievances",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("reference_number", sa.String(length=50), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=False),
        sa.Column("attachment_path", sa.String(length=500), nullable=True),
        sa.Column("current_status", sa.String(length=50), server_default="Submitted", nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.CheckConstraint(
            f"current_status IN ({GRIEVANCE_STATUSES})",
            name="ck_grievances_current_status",
        ),
    )
    op.create_index("ix_grievances_user_id", "grievances", ["user_id"], unique=False)
    op.create_index("ix_grievances_reference_number", "grievances", ["reference_number"], unique=True)
    op.create_index("ix_grievances_category", "grievances", ["category"], unique=False)
    op.create_index("ix_grievances_current_status", "grievances", ["current_status"], unique=False)

    op.create_table(
        "grievance_history",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("grievance_id", sa.String(length=36), nullable=False),
        sa.Column("changed_by", sa.String(length=36), nullable=True),
        sa.Column("old_status", sa.String(length=50), nullable=True),
        sa.Column("new_status", sa.String(length=50), nullable=False),
        sa.Column("remarks", sa.Text(), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(["grievance_id"], ["grievances.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["changed_by"], ["users.id"], ondelete="SET NULL"),
        sa.CheckConstraint(
            f"new_status IN ({GRIEVANCE_STATUSES})",
            name="ck_grievance_history_new_status",
        ),
    )
    op.create_index("ix_grievance_history_grievance_id", "grievance_history", ["grievance_id"], unique=False)

    op.create_table(
        "knowledge_documents",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("department", sa.String(length=255), nullable=True),
        sa.Column("source_url", sa.String(length=500), nullable=True),
        sa.Column("last_reviewed", sa.String(length=50), nullable=False),
        *_timestamps(),
    )
    op.create_index("ix_knowledge_documents_title", "knowledge_documents", ["title"], unique=False)
    op.create_index("ix_knowledge_documents_category", "knowledge_documents", ["category"], unique=False)

    op.create_table(
        "chat_sessions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_chat_sessions_user_id", "chat_sessions", ["user_id"], unique=False)

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("sources", sa.JSON(), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(["session_id"], ["chat_sessions.id"], ondelete="CASCADE"),
        sa.CheckConstraint("role IN ('user', 'assistant')", name="ck_chat_messages_role"),
    )
    op.create_index("ix_chat_messages_session_id", "chat_messages", ["session_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_chat_messages_session_id", table_name="chat_messages")
    op.drop_table("chat_messages")
    op.drop_index("ix_chat_sessions_user_id", table_name="chat_sessions")
    op.drop_table("chat_sessions")
    op.drop_index("ix_knowledge_documents_category", table_name="knowledge_documents")
    op.drop_index("ix_knowledge_documents_title", table_name="knowledge_documents")
    op.drop_table("knowledge_documents")
    op.drop_index("ix_grievance_history_grievance_id", table_name="grievance_history")
    op.drop_table("grievance_history")
    op.drop_index("ix_grievances_current_status", table_name="grievances")
    op.drop_index("ix_grievances_category", table_name="grievances")
    op.drop_index("ix_grievances_reference_number", table_name="grievances")
    op.drop_index("ix_grievances_user_id", table_name="grievances")
    op.drop_table("grievances")
    op.drop_index("ix_services_category", table_name="services")
    op.drop_index("ix_services_name", table_name="services")
    op.drop_table("services")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
