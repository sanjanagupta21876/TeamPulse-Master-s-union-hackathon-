import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, MessageCircleQuestion, ServerCrash } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { RoomHeader } from '../components/mission/RoomHeader';
import { Whiteboard } from '../components/mission/Whiteboard';
import { StepTrack } from '../components/mission/StepTrack';
import { RoomFeed } from '../components/mission/RoomFeed';
import { MissionList } from '../components/mission/MissionList';
import { DiagnosisCard } from '../components/mission/DiagnosisCard';
import { InterventionCard } from '../components/mission/InterventionCard';
import { CheckInModal } from '../components/mission/CheckInModal';
import { SimulateUpdatePanel } from '../components/mission/SimulateUpdatePanel';
import { PresenterBar } from '../components/mission/PresenterBar';
import { AgentAvatar } from '../components/mission/Avatar';
import { nextGuideStep } from '../components/mission/presenterGuide';
import { teamApi } from '../services/teamApi';
import type { CheckInView, InterventionView, MissionControlView } from '../services/teamApi';

type Busy = null | 'analyze' | 'approve' | 'reject' | 'reset' | 'resolved' | 'still_blocked';

const GUIDE_KEY = 'teampulse_presenter_guide';

function readGuidePreference(): boolean {
  try {
    return localStorage.getItem(GUIDE_KEY) !== 'off';
  } catch {
    return true;
  }
}

function saveGuidePreference(on: boolean) {
  try {
    localStorage.setItem(GUIDE_KEY, on ? 'on' : 'off');
  } catch {
    // Storage can be unavailable (private window); the guide still toggles for this visit
  }
}

const Panel: React.FC<{ title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }> = ({
  title,
  aside,
  children,
  className = '',
}) => (
  <section className={`rounded-2xl border border-line bg-paper ${className}`}>
    <div className="px-5 pt-4 pb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line">
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      {aside}
    </div>
    {children}
  </section>
);

export const TeamRoomPage: React.FC = () => {
  const { toast } = useToast();
  const [view, setView] = useState<MissionControlView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInSession, setCheckInSession] = useState(0);
  const [pendingCheckIn, setPendingCheckIn] = useState<CheckInView | null>(null);
  const [guideOn, setGuideOn] = useState(readGuidePreference);

  const load = useCallback(
    () =>
      teamApi.getMissionControl().then(
        (data) => {
          setView(data);
          setLoadError(null);
        },
        (err) => setLoadError(err instanceof Error ? err.message : String(err))
      ),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  const toggleGuide = useCallback(() => {
    setGuideOn((on) => {
      saveGuidePreference(!on);
      return !on;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key.toLowerCase() !== 'g' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      toggleGuide();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleGuide]);

  const fail = (err: unknown) => toast(err instanceof Error ? err.message : String(err), undefined, 'error');

  const act = async (kind: Exclude<Busy, null>, fn: () => Promise<MissionControlView>, success?: string) => {
    setBusy(kind);
    try {
      setView(await fn());
      if (success) toast(success, undefined, 'success');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  if (loadError) {
    return (
      <div className="max-w-md mx-auto mt-24 text-center space-y-3">
        <ServerCrash className="w-8 h-8 text-red mx-auto" />
        <h1 className="font-display text-xl font-semibold text-ink">The team room can't reach the backend</h1>
        <p className="text-sm text-pencil">{loadError}</p>
        <Button variant="secondary" onClick={load}>
          Try again
        </Button>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="flex items-center justify-center py-32 text-pencil gap-2 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Opening the team room…
      </div>
    );
  }

  const roster = view.crew.map((c) => c.call_sign);
  const root = view.missions.find((m) => m.id === view.root_bottleneck_id) ?? null;
  const owner = root?.owner_call_sign ?? 'the owner';
  const active = view.active_intervention;
  const previous: InterventionView | null = active?.previous_intervention_id
    ? view.interventions.find((i) => i.id === active.previous_intervention_id) ?? null
    : null;
  const activeMission = active ? view.missions.find((m) => m.id === active.mission_id) ?? null : null;
  const rootCheckIns = root ? view.checkins.filter((c) => c.mission_id === root.id) : [];
  const answeredCheckIn = rootCheckIns.find((c) => c.answer) ?? null;
  const unansweredCheckIn = rootCheckIns.find((c) => !c.answer) ?? null;
  const history = view.interventions.filter((i) => i.id !== active?.id).reverse();
  const lastResolved = view.interventions.find((i) => i.status === 'resolved') ?? null;

  const guide = nextGuideStep(view, checkInOpen);
  const targets = guideOn ? guide.targets : [];
  const glow = (t: (typeof targets)[number]) => (targets.includes(t) ? 'guide-target' : '');

  const openCheckIn = (pending: CheckInView | null) => {
    setPendingCheckIn(pending);
    setCheckInSession((n) => n + 1);
    setCheckInOpen(true);
  };

  const sendCheckIn = async () => {
    if (!root) return;
    try {
      const created = await teamApi.createCheckIn(root.id);
      setPendingCheckIn(created);
      await load();
    } catch (err) {
      fail(err);
    }
  };

  const answerCheckIn = async (answer: string) => {
    if (!pendingCheckIn) return;
    try {
      await teamApi.answerCheckIn(pendingCheckIn.id, answer);
      setCheckInOpen(false);
      setPendingCheckIn(null);
      await load();
    } catch (err) {
      fail(err);
    }
  };

  const renderAgent = () => {
    if (active && (active.status === 'proposed' || active.status === 'escalated')) {
      return (
        <div className="space-y-6">
          <DiagnosisCard intervention={active} compact={active.attempt_no > 1} />
          <InterventionCard
            intervention={active}
            previous={previous}
            busy={busy === 'approve' || busy === 'reject' ? busy : null}
            highlightApprove={targets.includes('approve')}
            onApprove={() => act('approve', () => teamApi.approve(active.id))}
            onReject={() => act('reject', () => teamApi.reject(active.id))}
          />
        </div>
      );
    }

    if (active && active.status === 'approved') {
      return (
        <div className="space-y-4">
          <InterventionCard intervention={active} previous={previous} />
          <SimulateUpdatePanel
            missionTitle={active.mission_title}
            ownerCallSign={activeMission?.owner_call_sign ?? null}
            busy={busy === 'resolved' || busy === 'still_blocked' ? busy : null}
            highlight={targets.includes('still_blocked') ? 'still_blocked' : targets.includes('resolved') ? 'resolved' : null}
            onSimulate={(outcome) => act(outcome, () => teamApi.simulateUpdate(active.mission_id, outcome))}
          />
        </div>
      );
    }

    if (!root) {
      return (
        <div className="space-y-2">
          <p className="flex items-center gap-2 font-display text-xl font-semibold text-green">
            <CheckCircle2 className="w-5 h-5" />
            {view.loop_stage === 'recovered' ? 'Recovered. Nothing is blocked right now.' : 'Nothing is blocked right now.'}
          </p>
          {lastResolved && (
            <p className="text-sm text-ink-soft max-w-[64ch]">
              “{lastResolved.action_title}” worked on attempt {lastResolved.attempt_no}. {lastResolved.verification_note}
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div>
          <p className="text-xs text-pencil">Detected</p>
          <h3 className="mt-1 font-display text-xl font-semibold text-ink leading-snug">
            {root.title} looks like the root bottleneck
          </h3>
          <p className="mt-1.5 text-sm text-ink-soft max-w-[64ch]">
            {root.downstream.length > 0
              ? `${root.downstream.length} missions can't finish until it moves. `
              : ''}
            Signals: {root.signals.map((s) => s.message.replace(/\.$/, '').toLowerCase()).join('; ')}.
          </p>
        </div>

        {answeredCheckIn ? (
          <blockquote className="border-l-2 border-marker/50 pl-3 text-sm italic text-ink">
            “{answeredCheckIn.answer}”
            <footer className="mt-1 not-italic text-xs text-pencil">{owner}, private check-in</footer>
          </blockquote>
        ) : (
          <p className="text-sm text-pencil max-w-[64ch]">
            Ask {owner} privately first. With an answer, the diagnosis is based on what's actually happening, not just on
            the signals.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {!answeredCheckIn &&
            (unansweredCheckIn ? (
              <Button
                variant="secondary"
                onClick={() => openCheckIn(unansweredCheckIn)}
                leftIcon={<MessageCircleQuestion className="w-4 h-4" />}
                className={glow('answer')}
              >
                Answer as {owner}
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => openCheckIn(null)}
                leftIcon={<MessageCircleQuestion className="w-4 h-4" />}
                className={glow('checkin')}
              >
                Send {owner} a private check-in
              </Button>
            ))}
          <Button
            variant={answeredCheckIn ? 'primary' : 'secondary'}
            onClick={() => act('analyze', () => teamApi.analyze())}
            isLoading={busy === 'analyze'}
            className={glow('analyze')}
          >
            Diagnose and recommend
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-6 ${guideOn ? 'pb-36' : ''}`}>
      <RoomHeader
        view={view}
        guideOn={guideOn}
        onToggleGuide={toggleGuide}
        onReset={() => act('reset', () => teamApi.resetDemo(), 'Demo reset. 36 hours to the deadline.')}
        isResetting={busy === 'reset'}
        resetHighlighted={targets.includes('reset')}
      />

      <Whiteboard missions={view.missions} rootBottleneckId={view.root_bottleneck_id} roster={roster} />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
        <Panel
          title="Ship Intelligence"
          aside={
            <span className="flex items-center gap-2 text-xs text-pencil">
              <AgentAvatar size="sm" />
              {view.llm_enabled ? 'AI-assisted.' : 'Rule-based mode (no AI key).'} You approve every action.
            </span>
          }
        >
          <div className="px-5 py-3 border-b border-line">
            <StepTrack stage={view.loop_stage} />
          </div>
          <div className="px-5 py-5">{renderAgent()}</div>
          {history.length > 0 && (
            <div className="px-5 py-4 border-t border-line">
              <h3 className="text-xs font-medium text-pencil mb-2">Earlier attempts</h3>
              <ul className="space-y-1.5">
                {history.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="text-faint tabular-nums">{i.attempt_no}.</span>
                    <span className="text-ink-soft">{i.action_title}</span>
                    <span
                      className={`text-xs font-medium ${
                        i.status === 'resolved' ? 'text-green' : i.status === 'failed' ? 'text-red' : 'text-faint'
                      }`}
                    >
                      {i.status === 'resolved' ? 'worked' : i.status === 'failed' ? "didn't work" : i.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <Panel title="Room activity" aside={<span className="text-xs text-pencil">Crew, Captain and Ship Intelligence</span>}>
          <RoomFeed events={view.timeline} crew={view.crew} now={view.now} />
        </Panel>
      </div>

      <Panel
        title="Missions"
        aside={<span className="text-xs text-pencil">Flags describe the work, never rank people</span>}
      >
        <MissionList missions={view.missions} roster={roster} now={view.now} />
      </Panel>

      <CheckInModal
        key={checkInSession}
        isOpen={checkInOpen}
        mission={root}
        pending={pendingCheckIn}
        guideTargets={targets}
        onClose={() => setCheckInOpen(false)}
        onSend={sendCheckIn}
        onAnswer={answerCheckIn}
      />

      {guideOn && <PresenterBar guide={guide} onClose={toggleGuide} />}
    </div>
  );
};
