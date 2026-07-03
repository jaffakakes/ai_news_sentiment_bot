"""
Mocked real-world tools the concierge agent can call.

These return realistic *fake* data so the whole agent → bubble flow works today
with zero API partnerships. Swap each body for a real provider later (an Airbnb
partner API, a travel aggregator, a commerce/search API) without changing the
agent, the server, or the iMessage app — the function signatures are the
contract.

Each tool is decorated with @beta_tool so the Anthropic SDK's tool runner can
call it automatically inside the agentic loop and feed results back to Claude.
"""

from __future__ import annotations

import json
from anthropic import beta_tool


# --- A tiny in-memory "inventory" standing in for a real search backend -------

_LISTINGS = [
    # id, title, neighborhood, nightly EUR, walk_score, rating, tags
    ("lx-01", "Sunlit studio in Alfama", "Alfama", 120, 95, 4.8, ["walkable", "view", "quiet"]),
    ("lx-02", "Design loft near Time Out Market", "Cais do Sodré", 145, 92, 4.9, ["walkable", "nightlife"]),
    ("lx-03", "Cozy 1BR by Miradouro", "Graça", 98, 88, 4.7, ["walkable", "view", "budget"]),
    ("lx-04", "Riverside apartment", "Belém", 160, 70, 4.6, ["spacious", "calm"]),
    ("lx-05", "Central room, tram at door", "Baixa", 85, 97, 4.5, ["walkable", "budget", "central"]),
]


@beta_tool
def search_listings(city: str, max_price: int = 1000, must_be_walkable: bool = False) -> str:
    """Search short-stay listings in a city.

    Args:
        city: Destination city, e.g. "Lisbon".
        max_price: Maximum nightly price in EUR.
        must_be_walkable: If true, only return highly walkable listings (walk score >= 85).
    """
    results = []
    for lid, title, hood, price, walk, rating, tags in _LISTINGS:
        if price > max_price:
            continue
        if must_be_walkable and walk < 85:
            continue
        results.append({
            "id": lid, "title": title, "neighborhood": hood,
            "price_eur": price, "walk_score": walk, "rating": rating, "tags": tags,
        })
    return json.dumps({"city": city, "count": len(results), "listings": results})


@beta_tool
def compare_listings(listing_ids: str) -> str:
    """Compare specific listings side by side to help pick a shortlist.

    Args:
        listing_ids: Comma-separated listing ids, e.g. "lx-01,lx-03".
    """
    wanted = {i.strip() for i in listing_ids.split(",") if i.strip()}
    rows = [
        {"id": lid, "title": title, "price_eur": price, "walk_score": walk, "rating": rating}
        for lid, title, hood, price, walk, rating, tags in _LISTINGS
        if lid in wanted
    ]
    return json.dumps({"comparison": rows})


@beta_tool
def draft_booking(listing_id: str, nights: int) -> str:
    """Prepare (but do NOT confirm) a booking for a listing.

    Returns a draft with the total price. A human still has to confirm and send
    from Messages — the agent can never finalize on its own.

    Args:
        listing_id: The listing to book.
        nights: Number of nights.
    """
    for lid, title, hood, price, walk, rating, tags in _LISTINGS:
        if lid == listing_id:
            total = price * nights
            return json.dumps({
                "draft": True,
                "listing_id": lid, "title": title,
                "nights": nights, "total_eur": total,
                "note": "Draft only — awaiting human confirmation in Messages.",
            })
    return json.dumps({"error": f"unknown listing {listing_id}"})


AGENT_TOOLS = [search_listings, compare_listings, draft_booking]
