"""Item quantities can be weights, and receipts with a code that isn't a currency get flagged.

`receipt_items.quantity` becomes Numeric(10, 3) so 1.5 kg is stored as 1.5 instead of being
rounded (which pushed the weight into the item name). Receipts whose stored currency isn't an
ISO 4217 code keep the value as it was stored, but move to needs_review with reason
`invalid_currency`, so they are checked instead of counted as a currency that doesn't exist.

Revision ID: 004_quantity_currency_check
Revises: 003_confirmed_at_fx_rates
Create Date: 2026-10-31

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.core.currencies import ISO_4217

revision: str = "004_quantity_currency_check"
down_revision: Union[str, None] = "003_confirmed_at_fx_rates"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "receipt_items", "quantity", type_=sa.Numeric(10, 3), existing_nullable=False,
        postgresql_using="quantity::numeric(10,3)",
    )
    op.get_bind().execute(
        sa.text(
            """
            UPDATE receipt
               SET status = 'needs_review',
                   review_reasons = (CASE WHEN jsonb_typeof(review_reasons::jsonb) = 'array'
                                          THEN review_reasons::jsonb ELSE '[]'::jsonb END  -- SQL or JSON null
                                     || '["invalid_currency"]'::jsonb)::json
             WHERE currency IS NOT NULL
               AND upper(currency) <> ALL(:codes)
               AND status IN ('ready', 'needs_review')
               AND NOT (jsonb_typeof(review_reasons::jsonb) = 'array'
                        AND review_reasons::jsonb ? 'invalid_currency')
            """
        ),
        {"codes": sorted(ISO_4217)},
    )


def downgrade() -> None:
    op.alter_column(
        "receipt_items", "quantity", type_=sa.Integer, existing_nullable=False,
        postgresql_using="round(quantity)::integer",
    )
