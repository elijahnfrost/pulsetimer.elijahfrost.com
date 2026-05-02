"use client";

import type { CSSProperties } from "react";
import { MAX_PATTERN_PHASES } from "@/lib/buildIntervalSchedule";
import {
  MAX_DURATION_TOTAL_SEC,
  normalizeHmsParts,
  splitTotalSecToHms,
  totalSecFromHms,
} from "@/lib/normalizeDurationParts";

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

const phaseRailMaskStyle: CSSProperties = {
  WebkitMaskImage: "linear-gradient(90deg, #000 0%, #000 78%, transparent 100%)",
  maskImage: "linear-gradient(90deg, #000 0%, #000 78%, transparent 100%)",
};

const letterGradient = "bg-[linear-gradient(90deg,transparent_0%,var(--color-fg)_42%,var(--color-fg)_100%)]";

const reorderNudgeClass =
  "rounded-sm px-1.5 py-0.5 text-[10px] font-medium leading-none text-ds-muted transition-colors duration-ds hover:bg-ds-section/40 hover:text-ds-fg disabled:pointer-events-none disabled:opacity-20 " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)] sm:text-[11px]";

const rowShell =
  "group relative isolate flex min-h-[5.25rem] flex-nowrap items-center gap-x-2 px-3 py-2.5 ps-[calc(6.5rem+0.125rem)] pe-3 sm:min-h-[6rem] sm:gap-x-4 sm:px-4 sm:py-3 sm:ps-[calc(7.75rem+0.25rem)] sm:pe-4";

const stepperPairClass =
  "flex w-full min-w-0 max-w-[4.25rem] overflow-hidden rounded-md border border-ds-divider bg-ds-page shadow-[inset_0_1px_0_rgba(127,119,106,0.06)] sm:max-w-[4.75rem]";

const stepperHitClass =
  "flex flex-1 items-center justify-center py-2 text-[13px] font-normal leading-none text-ds-soft antialiased transition-colors duration-ds hover:bg-ds-section/55 hover:text-ds-fg active:bg-ds-section/70 disabled:pointer-events-none disabled:opacity-[0.25] sm:py-2.5 sm:text-sm " +
  "focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-fg-muted)]";

type HmsClockProps = {
  phaseLetter: string;
  hours: number;
  minutes: number;
  seconds: number;
  totalSec: number;
  hourDec: () => void;
  hourInc: () => void;
  minDec: () => void;
  minInc: () => void;
  secDec: () => void;
  secInc: () => void;
  hourIncBlocked: boolean;
  minIncBlocked: boolean;
  secIncBlocked: boolean;
};

/**
 * One framed readout: large HH : MM : SS line, then a single row of three balanced stepper pairs (no triple “sandwich” chrome).
 */
function HmsClock({
  phaseLetter,
  hours,
  minutes,
  seconds,
  totalSec,
  hourDec,
  hourInc,
  minDec,
  minInc,
  secDec,
  secInc,
  hourIncBlocked,
  minIncBlocked,
  secIncBlocked,
}: HmsClockProps) {
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const atCap = totalSec >= MAX_DURATION_TOTAL_SEC;

  return (
    <div
      className="w-full max-w-[min(100%,17.5rem)] rounded-xl border border-ds-divider bg-ds-section/15 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(127,119,106,0.09)] sm:max-w-none sm:px-4 sm:py-3"
      role="group"
      aria-label={`Phase ${phaseLetter} duration`}
    >
      <p
        className="mb-2.5 text-center font-mono text-[1.375rem] font-medium leading-none tracking-[-0.02em] text-ds-fg tabular-nums sm:mb-3 sm:text-[1.625rem]"
        aria-live="polite"
      >
        <span className="inline-block min-w-[2ch] text-right">{hh}</span>
        <span className="mx-0.5 inline-block text-[0.92em] font-light text-ds-muted/70 sm:mx-1" aria-hidden>
          :
        </span>
        <span className="inline-block min-w-[2ch] text-right">{mm}</span>
        <span className="mx-0.5 inline-block text-[0.92em] font-light text-ds-muted/70 sm:mx-1" aria-hidden>
          :
        </span>
        <span className="inline-block min-w-[2ch] text-right">{ss}</span>
      </p>

      <div className="grid grid-cols-[1fr_1fr_1fr] gap-x-2 sm:gap-x-3">
        <div className="flex min-w-0 flex-col items-center gap-1">
          <div className={stepperPairClass}>
            <button
              type="button"
              className={`${stepperHitClass} border-e border-ds-divider/80`}
              aria-label={`Phase ${phaseLetter} — decrease hours`}
              disabled={totalSec < 3600}
              onClick={hourDec}
            >
              −
            </button>
            <button
              type="button"
              className={stepperHitClass}
              aria-label={`Phase ${phaseLetter} — increase hours`}
              disabled={atCap || hourIncBlocked}
              onClick={hourInc}
            >
              +
            </button>
          </div>
          <span className="text-[9px] font-medium uppercase tracking-[0.16em] text-ds-soft sm:text-[10px] sm:tracking-[0.18em]">
            Hr
          </span>
        </div>

        <div className="flex min-w-0 flex-col items-center gap-1">
          <div className={stepperPairClass}>
            <button
              type="button"
              className={`${stepperHitClass} border-e border-ds-divider/80`}
              aria-label={`Phase ${phaseLetter} — decrease minutes`}
              disabled={totalSec < 60}
              onClick={minDec}
            >
              −
            </button>
            <button
              type="button"
              className={stepperHitClass}
              aria-label={`Phase ${phaseLetter} — increase minutes`}
              disabled={atCap || minIncBlocked}
              onClick={minInc}
            >
              +
            </button>
          </div>
          <span className="text-[9px] font-medium uppercase tracking-[0.16em] text-ds-soft sm:text-[10px] sm:tracking-[0.18em]">
            Min
          </span>
        </div>

        <div className="flex min-w-0 flex-col items-center gap-1">
          <div className={stepperPairClass}>
            <button
              type="button"
              className={`${stepperHitClass} border-e border-ds-divider/80`}
              aria-label={`Phase ${phaseLetter} — decrease seconds`}
              disabled={totalSec < 1}
              onClick={secDec}
            >
              −
            </button>
            <button
              type="button"
              className={stepperHitClass}
              aria-label={`Phase ${phaseLetter} — increase seconds`}
              disabled={atCap || secIncBlocked}
              onClick={secInc}
            >
              +
            </button>
          </div>
          <span className="text-[9px] font-medium uppercase tracking-[0.16em] text-ds-soft sm:text-[10px] sm:tracking-[0.18em]">
            Sec
          </span>
        </div>
      </div>
    </div>
  );
}

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

  const incClamped = (totalSec: number, d: number) =>
    d > 0 && Math.min(MAX_DURATION_TOTAL_SEC, totalSec + d) === totalSec;

  return (
    <div className="relative w-full min-w-0 overflow-hidden rounded-sm border border-ds-divider bg-ds-page text-left" dir="ltr">
      {slots.map((slot, idx) => {
        const letter = LETTERS[idx] ?? String(idx + 1);
        const canReorder = slots.length > 1;
        const isLastSlotRow = idx === slots.length - 1;
        const hasAddRow = slots.length < MAX_PATTERN_PHASES;
        const dividerBelow = !(isLastSlotRow && !hasAddRow);

        const totalSec = totalSecFromHms(slot.hours, slot.minutes, slot.secondsPart);
        const bump = (d: number) => applyPhaseTotalSec(idx, totalSec + d);

        return (
          <div
            key={idx}
            className={`${rowShell} ${dividerBelow ? "border-b border-ds-divider" : ""}`}
          >
            <div
              className="pointer-events-none absolute inset-y-0 start-0 z-0 w-[6.5rem] opacity-[0.92] transition-opacity duration-300 ease-out group-hover:opacity-100 sm:w-[7.75rem]"
              aria-hidden
            >
              <div
                className="h-full w-full bg-gradient-to-r from-ds-section/60 via-ds-section/35 to-transparent"
                style={phaseRailMaskStyle}
              />
            </div>

            <span
              className={`absolute inset-y-0 start-0 z-[1] flex w-[6.5rem] -translate-x-4 items-center justify-start sm:w-[7.75rem] sm:-translate-x-5 ${letterGradient} bg-clip-text ps-0 font-sans text-[length:calc(6.5rem-0.72rem)] font-[100] tabular-nums leading-none tracking-[-0.06em] text-transparent antialiased [font-feature-settings:'kern'_1,'liga'_1] [text-rendering:geometricPrecision] sm:text-[length:calc(7.75rem-0.82rem)]`}
              aria-label={`Phase ${letter}`}
            >
              {letter}
            </span>

            <div className="relative z-10 flex min-w-0 flex-1 justify-center sm:justify-start">
              <HmsClock
                phaseLetter={letter}
                hours={slot.hours}
                minutes={slot.minutes}
                seconds={slot.secondsPart}
                totalSec={totalSec}
                hourDec={() => bump(-3600)}
                hourInc={() => bump(3600)}
                minDec={() => bump(-60)}
                minInc={() => bump(60)}
                secDec={() => bump(-1)}
                secInc={() => bump(1)}
                hourIncBlocked={incClamped(totalSec, 3600)}
                minIncBlocked={incClamped(totalSec, 60)}
                secIncBlocked={incClamped(totalSec, 1)}
              />
            </div>

            <div className="relative z-10 flex shrink-0 items-center gap-2 sm:gap-3">
              {slots.length > 1 ? (
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center rounded-sm px-2.5 py-2 font-sans text-[11px] font-normal uppercase tracking-[0.14em] text-ds-body transition-[color,background-color] duration-ds ease-ds-out hover:bg-ds-section/35 hover:text-ds-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)] sm:min-h-11 sm:px-3 sm:text-[12px] sm:tracking-[0.15em]"
                  aria-label={`Remove phase ${letter}`}
                  onClick={() => removePhase(idx)}
                >
                  Remove
                </button>
              ) : null}
              {canReorder ? (
                <div className="flex flex-col items-center justify-center gap-0.5">
                  <button
                    type="button"
                    className={reorderNudgeClass}
                    aria-label={`Move phase ${letter} up`}
                    disabled={idx === 0}
                    onClick={() => movePhase(idx, -1)}
                  >
                    ▴
                  </button>
                  <button
                    type="button"
                    className={reorderNudgeClass}
                    aria-label={`Move phase ${letter} down`}
                    disabled={idx === slots.length - 1}
                    onClick={() => movePhase(idx, 1)}
                  >
                    ▾
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}

      {slots.length < MAX_PATTERN_PHASES ? (
        <button
          type="button"
          aria-label={`Add phase ${LETTERS[slots.length] ?? "?"}…`}
          className="flex min-h-[2.875rem] w-full items-center justify-center gap-x-2 border-t border-ds-divider bg-ds-page px-4 py-2.5 font-sans text-[10px] font-normal uppercase tracking-[0.17em] text-ds-soft transition-colors duration-ds hover:bg-ds-section/40 hover:text-ds-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)] sm:min-h-11 sm:text-[11px] sm:tracking-[0.16em]"
          onClick={addPhase}
        >
          Add phase
          <span className="tabular-nums opacity-[0.82]" aria-hidden>
            ({LETTERS[slots.length] ?? "?"}…)
          </span>
        </button>
      ) : null}
    </div>
  );
}
