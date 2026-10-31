"""SQLAlchemy ORM model for cached historical exchange rates."""

from sqlalchemy import Column, Date, Numeric, String

from app.core.database import Base


class FxRate(Base):
    __tablename__ = "fx_rates"

    rate_date = Column(Date, primary_key=True)
    currency = Column(String(10), primary_key=True)
    usd_rate = Column(Numeric(20, 8), nullable=False)  # units of `currency` per 1 USD
