import React from 'react';
import { X } from 'lucide-react';
import type { GuideStep } from './presenterGuide';

export const PresenterBar: React.FC<{ guide: GuideStep; onClose: () => void }> = ({ guide, onClose }) => (
  <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 pointer-events-none lg:pl-[232px] xl:justify-end xl:pr-8">
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto w-full max-w-2xl xl:max-w-[400px] rounded-2xl bg-ink text-white shadow-[0_18px_40px_-16px_rgb(23_32_28/0.6)] px-5 py-3.5 flex items-start gap-4"
    >
      <div className="shrink-0 pt-0.5 text-center">
        {guide.step ? (
          <>
            <div className="font-display text-xl font-semibold leading-none tabular-nums">{guide.step}</div>
            <div className="text-[11px] text-white/50 mt-1">of {guide.total}</div>
          </>
        ) : (
          <div className="font-display text-xl font-semibold leading-none">✓</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-snug">{guide.instruction}</p>
        {guide.say && <p className="mt-1 text-sm text-white/70 leading-snug">Say: “{guide.say}”</p>}
      </div>
      <button
        onClick={onClose}
        className="shrink-0 p-1 rounded-md text-white/60 hover:text-white hover:bg-white/10"
        aria-label="Hide presenter guide"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  </div>
);
