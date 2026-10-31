"""Know which receipts a person confirmed, and cache exchange rates by date.

`receipt.confirmed_at` separates values the user checked (verified) from values the extractor
accepted on its own; existing rows stay NULL because nobody confirmed them in this sense.
`fx_rates` keeps historical USD-based rates, which never change once published.

Revision ID: 003_confirmed_at_fx_rates
Revises: 002_chat_deleted_at
Create Date: 2026-10-31

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_confirmed_at_fx_rates"
down_revision: Union[str, None] = "002_chat_deleted_at"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("receipt", sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "fx_rates",
        sa.Column("rate_date", sa.Date, primary_key=True),
        sa.Column("currency", sa.String(10), primary_key=True),
        sa.Column("usd_rate", sa.Numeric(20, 8), nullable=False),  # units of `currency` per 1 USD
    )


def downgrade() -> None:
    op.drop_table("fx_rates")
    op.drop_column("receipt", "confirmed_at")
