"""
The concierge agent — Claude Opus 4.8 with tool use.

Two phases:
  1. Agentic loop: Claude uses the mocked tools (search / compare / draft) to
     do the work, driven by the SDK's tool runner (no manual loop to maintain).
  2. Structured extraction: turn the agent's recommendation into the compact
     shortlist the iMessage bubble renders — a validated Pydantic object, so the
     client contract can't drift.

The agent PROPOSES; it never books. A human confirms and sends from Messages
(Apple requires the human tap anyway — good consent gate for shared spending).
"""

from __future__ import annotations

from typing import List
import anthropic
from pydantic import BaseModel, Field

from tools import AGENT_TOOLS

MODEL = "claude-opus-4-8"

SYSTEM = """You are a group concierge that helps two friends decide together inside an iMessage thread.
Use the tools to research real options, then recommend a shortlist of at most 3.
Be concise and decisive: lead with a one-line recommendation, then the picks.
You draft bookings but never confirm them — a human confirms and sends from Messages.
When people have voted, factor the votes in and move toward the group's choice."""


# --- The contract the iMessage bubble renders --------------------------------

class Proposal(BaseModel):
    id: str = Field(description="Stable id for this option, e.g. a listing id.")
    title: str
    subtitle: str = Field(description="One short line: neighborhood, vibe, or why it fits.")
    price: str = Field(description="Human-readable price, e.g. '€120 / night'.")
    highlights: List[str] = Field(default_factory=list, description="1-3 short selling points.")


class ConciergeReply(BaseModel):
    message: str = Field(description="One-line recommendation to show above the options.")
    proposals: List[Proposal] = Field(description="At most 3 options, best first.")
    needs_confirmation: bool = Field(
        description="True once there's a clear front-runner ready for a human to confirm."
    )


def run_concierge(intent: str, participants: List[str], votes: dict | None = None) -> ConciergeReply:
    """Run the agent for one turn and return a structured reply for the bubble."""
    client = anthropic.Anthropic()  # resolves ANTHROPIC_API_KEY or an `ant auth login` profile

    context = f"Participants: {', '.join(participants)}.\nRequest: {intent}"
    if votes:
        tally = ", ".join(f"{k}: {v}" for k, v in votes.items())
        context += f"\nVotes so far — {tally}. Move toward the group's choice."

    # Phase 1 — agentic tool loop. The tool runner calls the mocked tools and
    # loops until Claude is done, then hands back the final message.
    runner = client.beta.messages.tool_runner(
        model=MODEL,
        max_tokens=4096,
        system=SYSTEM,
        thinking={"type": "adaptive"},
        output_config={"effort": "medium"},
        tools=AGENT_TOOLS,
        messages=[{"role": "user", "content": context}],
    )
    final = None
    for message in runner:
        final = message
    recommendation = "".join(b.text for b in (final.content if final else []) if b.type == "text")

    # Phase 2 — turn the free-text recommendation into the validated shortlist
    # the bubble renders. messages.parse enforces the schema for us.
    parsed = client.messages.parse(
        model=MODEL,
        max_tokens=2048,
        messages=[{
            "role": "user",
            "content": (
                "Convert this concierge recommendation into structured proposals "
                "for a phone UI. Keep at most 3, best first.\n\n" + recommendation
            ),
        }],
        output_format=ConciergeReply,
    )
    return parsed.parsed_output
