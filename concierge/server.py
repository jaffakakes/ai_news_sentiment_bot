"""
HTTP endpoint the iMessage app calls.

The extension is a thin client: it POSTs the group's intent (and any votes so
far) here, this server runs the Claude agent, and returns the shortlist the
bubble renders. Keep your ANTHROPIC_API_KEY on this server — never in the app.

Run:
    pip install -r requirements.txt
    export ANTHROPIC_API_KEY=sk-ant-...        # or: ant auth login
    uvicorn server:app --reload --port 8000

Then POST:
    curl -s localhost:8000/concierge -H 'content-type: application/json' -d '{
      "intent": "Airbnb in Lisbon, 2 nights, under 150, walkable",
      "participants": ["Me", "Alex"]
    }' | python -m json.tool
"""

from __future__ import annotations

from typing import List, Optional
from fastapi import FastAPI
from pydantic import BaseModel

from agent import run_concierge, ConciergeReply

app = FastAPI(title="iMessage Concierge")


class ConciergeRequest(BaseModel):
    intent: str
    participants: List[str] = ["Me", "Friend"]
    votes: Optional[dict] = None


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/concierge", response_model=ConciergeReply)
def concierge(req: ConciergeRequest) -> ConciergeReply:
    return run_concierge(req.intent, req.participants, req.votes)
