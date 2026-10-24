from dataclasses import dataclass
from typing import Dict, List, Optional

SUCCESS_CRITERIA = (
    "At the next update the mission is no longer blocked and progress has moved forward "
    "by at least 10 percentage points (or the mission is done)."
)


@dataclass(frozen=True)
class RecoveryAction:
    code: str
    title: str
    summary: str
    steps: List[str]
    message_template: str


ACTIONS: Dict[str, RecoveryAction] = {
    "minimal_contract_with_mocks": RecoveryAction(
        code="minimal_contract_with_mocks",
        title="Agree a minimal API contract; Frontend continues on mock data",
        summary="Lock only the endpoints and fields the demo needs so both sides can work in parallel.",
        steps=[
            "30-minute call between {owner} and the Frontend owner to list the endpoints the demo needs.",
            "Write the request/response shapes in a shared doc; the Captain signs off.",
            "Frontend switches to mock data that follows the contract.",
            "{owner} implements the agreed endpoints first; anything else is parked.",
        ],
        message_template=(
            "Hi {owner}, thanks for flagging what's blocking {mission}. Let's agree a small API contract "
            "today (only what the demo needs) so Frontend can keep moving on mock data. "
            "Could you join a 30-minute call with the Frontend owner?"
        ),
    ),
    "pairing_session": RecoveryAction(
        code="pairing_session",
        title="Pairing session on the blocker",
        summary="Pair {owner} with a teammate for a focused, time-boxed session on the exact blocker.",
        steps=[
            "Pick a teammate with the most relevant experience who is not on the critical path.",
            "Run a 90-minute pairing session focused only on the blocker.",
            "Post a short update afterwards: what moved, what is still stuck.",
        ],
        message_template=(
            "Hi {owner}, would a 90-minute pairing session help with {mission}? Someone can sit with you "
            "on exactly the part that is stuck."
        ),
    ),
    "reduce_scope": RecoveryAction(
        code="reduce_scope",
        title="Reduce scope to a demo-critical slice",
        summary="Cut {mission} down to the minimum the final demo needs and defer the rest.",
        steps=[
            "List what {mission} must do for the demo; mark everything else as post-deadline.",
            "Captain confirms the reduced scope with the team.",
            "Update downstream missions so they only depend on the reduced slice.",
        ],
        message_template=(
            "Hi {owner}, to protect the deadline we'd like to shrink {mission} to only what the demo needs. "
            "Can we go through the list together and agree what to park?"
        ),
    ),
    "timeboxed_spike_mentor": RecoveryAction(
        code="timeboxed_spike_mentor",
        title="Time-boxed spike, then ask a mentor",
        summary="Give the technical problem a fixed time box; if it is still stuck, take it to a mentor or TA.",
        steps=[
            "Write down the exact error or symptom and what has been tried.",
            "Spend at most 2 hours on a focused fix attempt.",
            "If still stuck, book a mentor/TA slot with the written summary.",
        ],
        message_template=(
            "Hi {owner}, let's give the issue on {mission} a 2-hour time box. If it's still stuck after that, "
            "we'll take your notes to a mentor, so you're not fighting it alone."
        ),
    ),
    "unblock_upstream_sync": RecoveryAction(
        code="unblock_upstream_sync",
        title="Short sync with the upstream owner",
        summary="Get the people on both sides of the dependency to agree what is needed and by when.",
        steps=[
            "15-minute sync between {owner} and the upstream mission owner.",
            "Agree the smallest deliverable that unblocks {mission} and a time for it.",
        ],
        message_template=(
            "Hi {owner}, it looks like {mission} is waiting on another piece of work. Can we do a quick "
            "15-minute sync with that owner to agree the smallest hand-off that unblocks you?"
        ),
    ),
    "parallel_with_mocks": RecoveryAction(
        code="parallel_with_mocks",
        title="Work in parallel with stubs",
        summary="Unblock {mission} by building against stubs or mock data until the dependency lands.",
        steps=[
            "Define the interface {mission} needs from its dependency.",
            "Build against a stub; swap in the real implementation when ready.",
        ],
        message_template=(
            "Hi {owner}, instead of waiting, could {mission} move ahead against a stub of what it needs? "
            "We'll swap in the real piece when it lands."
        ),
    ),
    "rebalance_work": RecoveryAction(
        code="rebalance_work",
        title="Rebalance work across the crew",
        summary="Move a well-defined part of {mission} to a crew member with spare capacity, with a clear hand-off.",
        steps=[
            "{owner} picks one self-contained part that someone else could take.",
            "Captain asks for a volunteer with spare capacity.",
            "Write a short hand-off note so nothing is lost.",
        ],
        message_template=(
            "Hi {owner}, it sounds like there's a lot on your plate right now. Would it help to hand one "
            "self-contained part of {mission} to someone with more time this week?"
        ),
    ),
    "internal_deadline_reset": RecoveryAction(
        code="internal_deadline_reset",
        title="Reset the internal milestone",
        summary="Move the internal due time for {mission} and re-plan downstream work around it.",
        steps=[
            "Agree a realistic new internal due time with {owner}.",
            "Shift downstream missions and check the final deadline still holds.",
        ],
        message_template=(
            "Hi {owner}, let's set a realistic new internal time for {mission} together and re-plan around it."
        ),
    ),
    "private_checkin_followup": RecoveryAction(
        code="private_checkin_followup",
        title="Private follow-up check-in",
        summary="Ask {owner} privately and kindly what is going on with {mission}; no blame.",
        steps=[
            "Send a short private message asking what is getting in the way.",
            "Offer two concrete kinds of help (pairing or scope cut).",
        ],
        message_template=(
            "Hi {owner}, just checking in on {mission}; no pressure. Is anything getting in the way? "
            "Happy to set up pairing or trim the scope if that would help."
        ),
    ),
    "captain_one_on_one": RecoveryAction(
        code="captain_one_on_one",
        title="Captain 1:1",
        summary="Captain has a short, supportive 1:1 with {owner} to understand the situation.",
        steps=[
            "Book a 15-minute call.",
            "Listen first; agree one next step together.",
        ],
        message_template=(
            "Hi {owner}, could we grab 15 minutes today to talk about {mission}? I'd like to understand "
            "how it's going and what would help."
        ),
    ),
    "handover_plan": RecoveryAction(
        code="handover_plan",
        title="Hand-over plan",
        summary="With {owner}'s agreement, hand {mission} to someone else with a clear hand-over.",
        steps=[
            "Agree the hand-over with {owner}.",
            "{owner} writes a short status note; new owner confirms they can take it.",
        ],
        message_template=(
            "Hi {owner}, would it make things easier if someone else picked up {mission}? We'd do a proper "
            "hand-over, and only if you're okay with it."
        ),
    ),
    "split_mission": RecoveryAction(
        code="split_mission",
        title="Split the mission",
        summary="Split {mission} into smaller missions that can be finished and verified separately.",
        steps=[
            "Break {mission} into 2-3 parts with their own done criteria.",
            "Deliver the part downstream work needs first.",
        ],
        message_template=(
            "Hi {owner}, {mission} looks big for the time left. Could we split it into smaller pieces and "
            "ship the part others are waiting on first?"
        ),
    ),
    "captain_decision": RecoveryAction(
        code="captain_decision",
        title="Captain decision needed",
        summary="The planned recovery actions for {mission} did not clear the blocker. The Captain needs to decide: cut scope further, change owners, or renegotiate the deadline.",
        steps=[
            "Review the attempts and outcomes in the timeline.",
            "Decide with the team: cut scope, change owners, or ask the instructor about the deadline.",
        ],
        message_template=(
            "Team, the recovery steps for {mission} haven't cleared it yet. Let's meet briefly and decide "
            "together how we protect the deadline."
        ),
    ),
}

PLAYBOOKS: Dict[str, List[str]] = {
    "unclear_contract": ["minimal_contract_with_mocks", "pairing_session", "reduce_scope"],
    "technical_blocker": ["pairing_session", "timeboxed_spike_mentor", "reduce_scope"],
    "waiting_on_dependency": ["unblock_upstream_sync", "parallel_with_mocks", "reduce_scope"],
    "capacity": ["rebalance_work", "reduce_scope", "internal_deadline_reset"],
    "unresponsive": ["private_checkin_followup", "captain_one_on_one", "handover_plan"],
    "scope_too_large": ["reduce_scope", "split_mission", "rebalance_work"],
}

ESCALATION_ACTION = "captain_decision"


def next_action(cause: str, already_tried: List[str]) -> Optional[RecoveryAction]:
    """Next playbook action for the cause that has not been tried on this mission yet."""
    for code in PLAYBOOKS.get(cause, []):
        if code not in already_tried:
            return ACTIONS[code]
    return None


def render(action: RecoveryAction, owner: str, mission: str) -> Dict[str, object]:
    fill = {"owner": owner, "mission": mission}
    return {
        "title": action.title.format(**fill),
        "summary": action.summary.format(**fill),
        "steps": [s.format(**fill) for s in action.steps],
        "message": action.message_template.format(**fill),
    }
