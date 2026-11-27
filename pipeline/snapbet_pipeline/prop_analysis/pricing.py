"""What a quote really costs, and what it is worth against our probability (research, paper only).

Sportsbooks: decimal odds; the book's margin is already inside the price, there is no extra fee.
Kalshi: you pay the ask in dollars for a contract that pays $1, plus a taker fee of
ceil(0.07 x contracts x P x (1 - P)) dollars per order (rounded UP to the cent). The No side is
bought at 1 - yes_bid. The fee is spread over ORDER_CONTRACTS contracts here; a 1-contract order
pays a whole cent of fee, which matters a lot near 0 or 1.

"Displayed" probability (the no-vig average of books, or Kalshi's last trade) is what a page shows.
It is NOT a price anyone can trade at; EV always uses the executable price.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

KALSHI_TAKER_RATE = 0.07
ORDER_CONTRACTS = 100


def kalshi_fee(price: float, contracts: int = ORDER_CONTRACTS, rate: float = KALSHI_TAKER_RATE) -> float:
    """Taker fee per contract, in dollars, for one order of `contracts` at `price`."""
    if not 0 < price < 1:
        return 0.0
    total = math.ceil(round(rate * contracts * price * (1 - price) * 100, 6)) / 100
    return total / contracts


@dataclass
class Quote:
    source: str                 # sportsbook | kalshi
    side: str                   # yes (over) | no (under)
    price: float                # decimal odds (sportsbook) or ask in dollars (Kalshi)
    fee: float                  # per contract (Kalshi) or 0
    cost: float                 # dollars staked per contract (Kalshi) or 1 (sportsbook)
    payout: float               # dollars returned on a win per `cost` staked

    @property
    def breakeven_prob(self) -> float:
        return self.cost / self.payout

    def ev(self, p: float, push: float = 0.0) -> float:
        """Expected profit per $1 staked if the side wins with probability p and pushes (stake back)
        with probability `push`."""
        return p * self.payout / self.cost + push - 1

    def pnl(self, result: str, settlement_value: Optional[float] = None) -> Optional[float]:
        """Profit per $1 staked. result: win | loss | push | void | fair (fair: settlement_value is
        what this side's contract paid)."""
        if result == "win":
            return self.payout / self.cost - 1
        if result == "loss":
            return -1.0
        if result in ("push", "void"):
            return 0.0
        if result == "fair" and settlement_value is not None:
            return settlement_value / self.cost - 1
        return None


def sportsbook_quote(side: str, decimal_odds: float) -> Optional[Quote]:
    if not decimal_odds or decimal_odds <= 1:
        return None
    return Quote("sportsbook", side, float(decimal_odds), 0.0, 1.0, float(decimal_odds))


def kalshi_quote(side: str, yes_bid: Optional[float], yes_ask: Optional[float]) -> Optional[Quote]:
    ask = yes_ask if side == "yes" else (1 - yes_bid if yes_bid is not None else None)
    if ask is None or not 0 < ask < 1:
        return None
    fee = kalshi_fee(ask)
    return Quote("kalshi", side, float(ask), fee, float(ask) + fee, 1.0)


def breakeven_price(source: str, p: float) -> Optional[float]:
    """The worst price at which a side with true probability p still breaks even after fees:
    decimal odds for a book, the highest ask in dollars for Kalshi."""
    if not 0 < p < 1:
        return None
    if source == "sportsbook":
        return 1 / p
    lo, hi = 0.0, p                       # largest ask a with a + fee(a) <= p
    for _ in range(40):
        mid = (lo + hi) / 2
        if mid + kalshi_fee(mid) <= p:
            lo = mid
        else:
            hi = mid
    return math.floor(lo * 100) / 100     # Kalshi trades in whole cents


def side_result(record_result: Optional[str], side: str) -> Optional[str]:
    """Common-record result (yes / no / push / void / fair) -> result for the side bought."""
    if record_result in (None, ""):
        return None
    if record_result in ("push", "void", "fair"):
        return record_result
    return "win" if (record_result == "yes") == (side == "yes") else "loss"
