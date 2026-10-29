"""Baseline schema: users, receipts, items, chat history, LLM usage.

Revision ID: 001_baseline
Revises:
Create Date: 2026-10-29

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _timestamps() -> list:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    ]


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("user_id", sa.BigInteger, primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("phone_number", sa.String(30), nullable=True, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("plan", sa.String(20), nullable=False, server_default="free"),
        *_timestamps(),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "receipt",
        sa.Column("receipt_id", sa.BigInteger, primary_key=True),
        sa.Column(
            "user_id",
            sa.BigInteger,
            sa.ForeignKey("users.user_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(20), nullable=False, server_default="ready"),
        sa.Column("review_reasons", sa.JSON, nullable=True),
        sa.Column("merchant_name", sa.String(150), nullable=True),
        sa.Column("receipt_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("total_amount", sa.Numeric(10, 2), nullable=True),
        sa.Column("total_taxes", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("other", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(10), nullable=True),
        sa.Column("category", sa.String(30), nullable=True),
        sa.Column("raw_text", sa.Text, nullable=True),
        sa.Column("image_key", sa.String(255), nullable=True),
        sa.Column("source_filename", sa.String(255), nullable=True),
        *_timestamps(),
    )
    op.create_index("ix_receipt_user_id", "receipt", ["user_id"])
    op.create_index("ix_receipt_status", "receipt", ["status"])
    op.create_index("ix_receipt_user_date", "receipt", ["user_id", "receipt_date"])

    op.create_table(
        "receipt_items",
        sa.Column("item_id", sa.BigInteger, primary_key=True),
        sa.Column(
            "receipt_id",
            sa.BigInteger,
            sa.ForeignKey("receipt.receipt_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("item_name", sa.String(150), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False),
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("line_total", sa.Numeric(10, 2), nullable=False),
        sa.Column("taxes", sa.Numeric(10, 2), nullable=False, server_default="0"),
    )
    op.create_index("ix_receipt_items_receipt_id", "receipt_items", ["receipt_id"])

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column(
            "user_id",
            sa.BigInteger,
            sa.ForeignKey("users.user_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("thread_id", sa.String(64), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_chat_messages_user_thread", "chat_messages", ["user_id", "thread_id", "id"])

    op.create_table(
        "llm_usage",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column(
            "user_id",
            sa.BigInteger,
            sa.ForeignKey("users.user_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("deployment", sa.String(100), nullable=False),
        sa.Column("input_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_llm_usage_user_created", "llm_usage", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_table("llm_usage")
    op.drop_table("chat_messages")
    op.drop_table("receipt_items")
    op.drop_table("receipt")
    op.drop_table("users")
