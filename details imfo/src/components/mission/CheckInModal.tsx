import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { CheckInView, MissionView } from '../../services/teamApi';
import type { GuideTarget } from './presenterGuide';

export const DEMO_CHECKIN_ANSWER =
  "I can't finish the endpoints because we never agreed on the API contract. I don't know what fields the frontend needs, so I keep rewriting the same routes.";

interface CheckInModalProps {
  isOpen: boolean;
  mission: MissionView | null;
  pending: CheckInView | null;
  guideTargets: GuideTarget[];
  onClose: () => void;
  onSend: () => Promise<void>;
  onAnswer: (answer: string) => Promise<void>;
}

export const CheckInModal: React.FC<CheckInModalProps> = ({ isOpen, mission, pending, guideTargets, onClose, onSend, onAnswer }) => {
  const [answer, setAnswer] = useState(DEMO_CHECKIN_ANSWER);
  const [busy, setBusy] = useState(false);

  if (!mission) return null;
  const owner = mission.owner_call_sign ?? 'the owner';

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={pending ? `${owner}'s view` : `Private check-in with ${owner}`}
      description={
        pending
          ? `Demo: you're answering for ${owner}. Only the Captain sees this answer.`
          : `Ask what's stopping ${mission.title}. It goes only to ${owner}.`
      }
    >
      {!pending ? (
        <div className="space-y-4">
          <p className="rounded-lg bg-wall border border-line px-4 py-3 text-[15px] text-ink leading-relaxed">
            Quick private check-in: what is the main thing stopping {mission.title} from moving right now? There's no
            wrong answer; this only helps us pick the right kind of help.
          </p>
          <p className="flex items-center gap-2 text-xs text-pencil">
            <Lock className="w-3.5 h-3.5" /> Private. Check-ins are about the mission, never a score for the person.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              isLoading={busy}
              onClick={() => run(onSend)}
              className={guideTargets.includes('send-checkin') ? 'guide-target' : ''}
            >
              Send check-in
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-pencil">{pending.question}</p>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">{owner}'s answer</span>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={4}
              className="w-full rounded-lg bg-paper border border-line px-3 py-2.5 text-[15px] text-ink leading-relaxed focus:outline-none focus:border-marker focus:ring-2 focus:ring-marker/20"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Answer later
            </Button>
            <Button
              variant="primary"
              isLoading={busy}
              disabled={!answer.trim()}
              onClick={() => run(() => onAnswer(answer.trim()))}
              className={guideTargets.includes('submit-answer') ? 'guide-target' : ''}
            >
              Send answer
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
