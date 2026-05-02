"use client";

import { MAX_PATTERN_PHASES } from "@/lib/buildIntervalSchedule";
import {
  normalizeHmsParts,
  splitTotalSecToHms,
  totalSecFromHms,
} from "@/lib/normalizeDurationParts";
import {
  HmsClock,
} from "./BigEditors";

import { BigRow } from "./BigRow";

export type PatternConstraint = "fitTotal" | "fixed";

export type PatternPhasePersist = {
  hours: number;
  minutes: number;
  secondsPart: number;
};

type Props = {
  slots: PatternPhasePersist[];
  onSlotsChange: (next: PatternPhasePersist[]) => void;
};

const LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

const TrashIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2H8c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

const ArrowUpIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m18 15-6-6-6 6"/>
  </svg>
);

const ArrowDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6"/>
  </svg>
);

const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);

export function PatternScheduleEditor({ slots, onSlotsChange }: Props) {
  const applyPhaseTotalSec = (idx: number, totalSecRaw: number) => {
    const nextSlot = splitTotalSecToHms(totalSecRaw);
    const copy = slots.slice();
    copy[idx] = nextSlot;
    onSlotsChange(copy);
  };

  const addPhase = () => {
    if (slots.length >= MAX_PATTERN_PHASES) return;
    const next: PatternPhasePersist[] = [...slots, normalizeHmsParts(0, 1, 0)];
    onSlotsChange(next);
  };

  const removePhase = (idx: number) => {
    if (slots.length <= 1) return;
    onSlotsChange(slots.filter((_, i) => i !== idx));
  };

  const movePhase = (idx: number, delta: -1 | 1) => {
    const j = idx + delta;
    if (j < 0 || j >= slots.length) return;
    const next = slots.slice();
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    onSlotsChange(next);
  };

  return (
    <div className="relative w-full min-w-0 overflow-hidden rounded-sm border border-ds-divider bg-ds-page text-left" dir="ltr">
      {slots.map((slot, idx) => {
        const letter = LETTERS[idx] ?? String(idx + 1);
        const canReorder = slots.length > 1;
        const isLastSlotRow = idx === slots.length - 1;
        const hasAddRow = slots.length < MAX_PATTERN_PHASES;
        const dividerBelow = !(isLastSlotRow && !hasAddRow);

        return (
          <div key={idx}>
            <BigRow
              label={letter}
              borderBottom={dividerBelow}
              rightAction={
                <>
                  {canReorder ? (
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <button
                        type="button"
                        className="flex h-6 w-6 items-center justify-center rounded-sm text-ds-muted transition-colors duration-ds hover:bg-ds-section/40 hover:text-ds-fg disabled:pointer-events-none disabled:opacity-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)]"
                        aria-label={`Move phase ${letter} up`}
                        disabled={idx === 0}
                        onClick={() => movePhase(idx, -1)}
                      >
                        <ArrowUpIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="flex h-6 w-6 items-center justify-center rounded-sm text-ds-muted transition-colors duration-ds hover:bg-ds-section/40 hover:text-ds-fg disabled:pointer-events-none disabled:opacity-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)]"
                        aria-label={`Move phase ${letter} down`}
                        disabled={idx === slots.length - 1}
                        onClick={() => movePhase(idx, 1)}
                      >
                        <ArrowDownIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                  {slots.length > 1 ? (
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-sm text-ds-muted transition-[color,background-color] duration-ds ease-ds-out hover:bg-red-500/10 hover:text-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)] sm:h-11 sm:w-11"
                      aria-label={`Remove phase ${letter}`}
                      onClick={() => removePhase(idx)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  ) : null}
                </>
              }
            >
              <HmsClock
                phaseLetter={letter}
                hours={slot.hours}
                minutes={slot.minutes}
                seconds={slot.secondsPart}
                onSetHms={(h, m, s) => applyPhaseTotalSec(idx, totalSecFromHms(h, m, s))}
              />
            </BigRow>
          </div>
        );
      })}

      {slots.length < MAX_PATTERN_PHASES ? (
        <button
          type="button"
          aria-label={`Add phase ${LETTERS[slots.length] ?? "?"}…`}
          className="flex min-h-[2.875rem] w-full items-center justify-center gap-x-2 border-t border-ds-divider bg-ds-page px-4 py-2.5 font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-ds-soft transition-colors duration-ds hover:bg-ds-section/40 hover:text-ds-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)] sm:min-h-11 sm:text-[12px]"
          onClick={addPhase}
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Add phase
        </button>
      ) : null}
    </div>
  );
}
