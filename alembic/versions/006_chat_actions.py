"""Changes Wara'a prepares in the chat, which only the user's tap carries out.

A row is created when the assistant proposes a change (set a category, mark reviewed, delete) and
moves from pending to done, cancelled, expired, stale (the receipt changed since) or failed.
`target_updated_at` is the receipt's updated_at when proposed, so a confirmation can tell whether it
still applies. `receipt_id` has no foreign key: a deleted receipt keeps its action as a record.

Revision ID: 006_chat_actions
Revises: 005_chat_attachments
Create Date: 2026-10-31

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006_chat_actions"
down_revision: Union[str, None] = "005_chat_attachments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "chat_actions",
        sa.Column("action_id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.user_id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("thread_id", sa.String(64), nullable=True),
        sa.Column("message_id", sa.BigInteger, sa.ForeignKey("chat_messages.id", ondelete="SET NULL"),
                  nullable=True),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("receipt_id", sa.BigInteger, nullable=False),
        sa.Column("payload", sa.JSON, nullable=True),
        sa.Column("summary", sa.JSON, nullable=True),
        sa.Column("target_updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(12), nullable=False, server_default="pending"),
        sa.Column("result", sa.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_chat_actions_user_receipt", "chat_actions", ["user_id", "receipt_id"])
    op.create_index("ix_chat_actions_message", "chat_actions", ["message_id"])


def downgrade() -> None:
    op.drop_index("ix_chat_actions_message", table_name="chat_actions")
    op.drop_index("ix_chat_actions_user_receipt", table_name="chat_actions")
    op.drop_table("chat_actions")
