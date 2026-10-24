import type { MissionControlView } from '../../services/teamApi';

export type GuideTarget = 'checkin' | 'send-checkin' | 'answer' | 'submit-answer' | 'analyze' | 'approve' | 'still_blocked' | 'resolved' | 'reset';

export interface GuideStep {
  step: number | null;
  total: number;
  instruction: string;
  say: string;
  targets: GuideTarget[];
}

const TOTAL = 7;

/**
 * Works out the next demo step from the live state, so the guide stays right
 * even if the presenter clicks ahead or resets midway.
 */
export function nextGuideStep(view: MissionControlView, checkInModalOpen: boolean): GuideStep {
  const root = view.missions.find((m) => m.id === view.root_bottleneck_id) ?? null;
  const owner = root?.owner_call_sign ?? 'the owner';
  const active = view.active_intervention;
  const step = (n: number, instruction: string, say: string, targets: GuideTarget[]): GuideStep => ({
    step: n,
    total: TOTAL,
    instruction,
    say,
    targets,
  });

  if (view.loop_stage === 'recovered') {
    return {
      step: null,
      total: TOTAL,
      instruction: 'Demo complete. Click Reset demo to run it again.',
      say: "Don't just track the deadline. Recover before it.",
      targets: ['reset'],
    };
  }

  if (active?.status === 'escalated') {
    return {
      step: null,
      total: TOTAL,
      instruction: 'Off script: every action was tried. Click Reset demo to start over.',
      say: 'When the playbook runs out, it hands the decision to the Captain instead of guessing.',
      targets: ['reset'],
    };
  }

  if (active?.status === 'proposed') {
    return active.attempt_no === 1
      ? step(
          4,
          'Approve the recommendation as Captain.',
          'It recommends one specific action. Nothing happens until the Captain approves.',
          ['approve']
        )
      : step(
          6,
          'Approve the new action.',
          "The first action didn't work, so it adapts. A different action, never the same reminder twice.",
          ['approve']
        );
  }

  if (active?.status === 'approved') {
    return active.attempt_no === 1
      ? step(
          5,
          `Simulate ${owner}'s next update: click Still blocked.`,
          'This follow-up update is simulated for the demo. Now it checks whether the action actually worked.',
          ['still_blocked']
        )
      : step(
          7,
          `Simulate ${owner}'s next update: click Blocker resolved.`,
          'Verified: the mission is moving again and the work behind it is unblocked.',
          ['resolved']
        );
  }

  if (!root) {
    return {
      step: null,
      total: TOTAL,
      instruction: 'No blockers right now. Click Reset demo to load the scenario.',
      say: '',
      targets: ['reset'],
    };
  }

  const checkins = view.checkins.filter((c) => c.mission_id === root.id);
  if (checkins.some((c) => c.answer)) {
    return step(
      3,
      'Click Diagnose and recommend.',
      `It combines the signals with ${owner}'s answer and names the likely root cause, with the evidence.`,
      ['analyze']
    );
  }
  if (checkins.length > 0) {
    return step(
      2,
      checkInModalOpen ? `Submit the answer as ${owner}.` : `Open ${owner}'s view and answer the check-in.`,
      `On ${owner}'s side it's a short private answer. No blame, no scores.`,
      checkInModalOpen ? ['submit-answer'] : ['answer']
    );
  }
  return step(
    1,
    checkInModalOpen ? 'Send the check-in.' : `Send ${owner} a private check-in.`,
    `${root.title} has been quiet and ${root.downstream.length} missions are waiting on it. Instead of another reminder, we ask what's stopping it.`,
    checkInModalOpen ? ['send-checkin'] : ['checkin']
  );
}
