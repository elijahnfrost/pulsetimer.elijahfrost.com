"use client";

import type { CSSProperties } from "react";
import { NumberInput } from "./NumberInput";
import { MAX_PATTERN_PHASES } from "@/lib/buildIntervalSchedule";
import { MAX_DURATION_TOTAL_SEC, normalizeDurationParts } from "@/lib/normalizeDurationParts";

export type PatternConstraint = "fitTotal" | "fixed";

export type PatternPhasePersist = {
  minutes: number;
  secondsPart: number;
};

type Props = {
  slots: PatternPhasePersist[];
  onSlotsChange: (next: PatternPhasePersist[]) => void;
};

const LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

/** Rail ~20% tighter than legacy sizes; mask feathers toward inputs; letter uses same horizontal gradient + bg-clip-text. */
const phaseRailMaskStyle: CSSProperties = {
  WebkitMaskImage: "linear-gradient(90deg, #000 0%, #000 78%, transparent 100%)",
  maskImage: "linear-gradient(90deg, #000 0%, #000 78%, transparent 100%)",
};

const letterGradient = "bg-[linear-gradient(90deg,transparent_0%,var(--color-fg)_42%,var(--color-fg)_100%)]";

/** Reorder arrows: interaction via hit area / hover fill only — no box borders. */
const reorderBtnClass =
  "flex h-11 min-w-11 shrink-0 items-center justify-center rounded-sm text-[15px] font-light leading-none text-ds-soft transition-colors duration-ds sm:h-12 sm:min-w-12 sm:text-[16px] " +
  "hover:bg-ds-section/45 hover:text-ds-fg " +
  "active:bg-ds-section/55 " +
  "disabled:pointer-events-none disabled:opacity-25 " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)]";

const rowShell =
  "group relative isolate flex min-h-[6.75rem] flex-nowrap items-center justify-start gap-x-3 px-3 py-3 ps-[calc(6.5rem+0.125rem)] pe-4 sm:min-h-[8rem] sm:gap-x-5 sm:px-4 sm:py-3.5 sm:ps-[calc(7.75rem+0.25rem)] sm:pe-5";

export function PatternScheduleEditor({ slots, onSlotsChange }: Props) {
  const applyPhase = (idx: number, minutes: number, secondsPart: number) => {
    const n = normalizeDurationParts(minutes, secondsPart);
    const next = slots.slice();
    next[idx] = { minutes: n.minutes, secondsPart: n.secondsPart };
    onSlotsChange(next);
  };

  const addPhase = () => {
    if (slots.length >= MAX_PATTERN_PHASES) return;
    onSlotsChange([...slots, { minutes: 1, secondsPart: 0 }]);
  };

  const removePhase = (idx: number) => {
    if (slots.length <= 1) return;
    onSlotsChange(slots.filter((_, i) => i !== idx));
  };

  const movePhase = (idx: number, delta: -1 | 1) => {
    const j = idx + delta;
    if (j < 0 || j >= slots.length) return;
    const next = slots.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
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

            <div className="relative z-10 flex min-w-0 flex-1 flex-nowrap items-center gap-x-3 sm:gap-x-5">
              {canReorder ? (
                <div className="relative z-10 flex shrink-0 flex-col gap-2">
                  <button
                    type="button"
                    className={reorderBtnClass}
                    aria-label={`Move phase ${letter} up`}
                    disabled={idx === 0}
                    onClick={() => movePhase(idx, -1)}
                  >
                    ▴
                  </button>
                  <button
                    type="button"
                    className={reorderBtnClass}
                    aria-label={`Move phase ${letter} down`}
                    disabled={idx === slots.length - 1}
                    onClick={() => movePhase(idx, 1)}
                  >
                    ▾
                  </button>
                </div>
              ) : null}

              <NumberInput
                density="dense"
                grow
                rounding="sharp"
                className="min-w-0 flex-1 basis-0"
                layout="compact"
                label="Min"
                value={slot.minutes}
                min={0}
                max={999}
                onChange={(v) => applyPhase(idx, v, slot.secondsPart)}
              />
              <NumberInput
                density="dense"
                grow
                narrow
                rounding="sharp"
                className="min-w-0 flex-1 basis-0"
                layout="compact"
                label="Sec"
                value={slot.secondsPart}
                min={0}
                max={59}
                strictClamp={false}
                commitOnBlur
                disableDec={slot.minutes * 60 + slot.secondsPart <= 0}
                disableInc={slot.minutes * 60 + slot.secondsPart >= MAX_DURATION_TOTAL_SEC}
                onChange={(raw) => applyPhase(idx, slot.minutes, raw)}
              />
            </div>

            <div className="relative z-10 ml-auto flex shrink-0 items-center ps-2 sm:ps-4">
              {slots.length > 1 ? (
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center rounded-sm px-3 py-2 font-sans text-[12px] font-normal uppercase tracking-[0.14em] text-ds-body transition-[color,background-color] duration-ds ease-ds-out hover:bg-ds-section/35 hover:text-ds-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)] sm:min-h-12 sm:px-3.5 sm:text-[13px] sm:tracking-[0.15em]"
                  aria-label={`Remove phase ${letter}`}
                  onClick={() => removePhase(idx)}
                >
                  Remove
                </button>
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
