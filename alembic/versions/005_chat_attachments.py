"""Assistant messages can carry receipt cards.

`chat_messages.attachments` holds what was attached to a reply ({"receipts": [card, ...]}), so a
conversation reloads with the same tappable receipts it was answered with.

Revision ID: 005_chat_attachments
Revises: 004_quantity_currency_check
Create Date: 2026-10-31

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005_chat_attachments"
down_revision: Union[str, None] = "004_quantity_currency_check"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("chat_messages", sa.Column("attachments", sa.JSON, nullable=True))


def downgrade() -> None:
    op.drop_column("chat_messages", "attachments")
