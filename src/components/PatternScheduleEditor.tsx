"use client";

import type { CSSProperties } from "react";
import { ControlButton } from "./Controls";
import { NumberInput } from "./NumberInput";
import { SegmentedControl } from "./SegmentedControl";
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
  patternConstraint: PatternConstraint;
  onPatternConstraintChange: (c: PatternConstraint) => void;
};

const LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

/** Mask: feather at the inner start edge (fade into left side of panel, stay inside border) */
const phaseRailMaskStyle: CSSProperties = {
  WebkitMaskImage: "linear-gradient(90deg, transparent 0%, #000 22%, #000 100%)",
  maskImage: "linear-gradient(90deg, transparent 0%, #000 22%, #000 100%)",
};

const reorderBtnClass =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded border border-transparent text-[10px] leading-none text-ds-soft transition-colors duration-ds " +
  "hover:border-ds-divider hover:bg-ds-section/30 hover:text-ds-fg " +
  "disabled:pointer-events-none disabled:opacity-25 " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)]";

export function PatternScheduleEditor({
  slots,
  onSlotsChange,
  patternConstraint,
  onPatternConstraintChange,
}: Props) {
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
    <div className="flex w-full min-w-0 flex-col gap-6 text-left">
      <div>
        <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-ds-soft sm:text-[11px] sm:tracking-[0.13em]">
          Phase timing
        </p>
        <SegmentedControl
          label="Phase timing mode"
          showLabel={false}
          value={patternConstraint}
          options={[
            { value: "fitTotal", label: "Scale to session" },
            { value: "fixed", label: "Fixed lengths" },
          ]}
          onChange={onPatternConstraintChange}
        />
      </div>

      <div>
        <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.12em] text-ds-soft sm:text-[11px] sm:tracking-[0.13em]">
          Phase durations
        </p>
        <div className="relative overflow-hidden rounded-md border border-ds-divider bg-ds-page">
          {slots.map((slot, idx) => {
            const letter = LETTERS[idx] ?? String(idx + 1);
            const canReorder = slots.length > 1;
            return (
              <div
                key={idx}
                className="group relative isolate flex min-h-[7rem] flex-wrap items-center gap-x-3 gap-y-3 border-b border-ds-divider py-2 ps-[9.25rem] pe-3 last:border-b-0 sm:min-h-[7.75rem] sm:gap-x-4 sm:ps-[10.5rem] sm:pe-4"
              >
                <div
                  className="pointer-events-none absolute inset-y-0 start-0 z-0 w-[9.25rem] opacity-[0.92] transition-opacity duration-300 ease-out group-hover:opacity-100 sm:w-[10.5rem]"
                  aria-hidden
                >
                  <div
                    className="h-full w-full bg-gradient-to-r from-transparent via-ds-section/35 to-ds-section/60"
                    style={phaseRailMaskStyle}
                  />
                </div>

                <span
                  className="absolute inset-y-0 start-0 z-[1] flex w-[9.25rem] items-center justify-center bg-gradient-to-r from-transparent via-ds-fg/45 to-ds-fg bg-clip-text ps-0 font-mono text-[calc(7rem-16px)] font-light tabular-nums leading-none tracking-tight text-transparent antialiased sm:w-[10.5rem] sm:text-[calc(7.75rem-18px)]"
                  aria-label={`Phase ${letter}`}
                >
                  {letter}
                </span>

                {canReorder ? (
                  <div className="relative z-10 flex shrink-0 flex-col gap-0.5">
                    <button
                      type="button"
                      className={reorderBtnClass}
                      aria-label={`Move phase ${letter} up`}
                      disabled={idx === 0}
                      onClick={() => movePhase(idx, -1)}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      className={reorderBtnClass}
                      aria-label={`Move phase ${letter} down`}
                      disabled={idx === slots.length - 1}
                      onClick={() => movePhase(idx, 1)}
                    >
                      ▼
                    </button>
                  </div>
                ) : null}

                <NumberInput
                  layout="compact"
                  label="Min"
                  value={slot.minutes}
                  min={0}
                  max={999}
                  onChange={(v) => applyPhase(idx, v, slot.secondsPart)}
                />
                <NumberInput
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
                <div className="relative z-10 ml-auto flex min-h-[2.75rem] items-center">
                  {slots.length > 1 ? (
                    <button
                      type="button"
                      className="rounded px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-ds-soft underline decoration-ds-divider decoration-1 underline-offset-4 transition-colors hover:text-ds-fg hover:decoration-ds-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)]"
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
        </div>
      </div>

      {slots.length < MAX_PATTERN_PHASES && (
        <ControlButton
          type="button"
          variant="secondary"
          className="!min-h-10 w-full py-3 sm:w-auto sm:self-start"
          onClick={addPhase}
        >
          Add phase ({LETTERS[slots.length] ?? "?"}…)
        </ControlButton>
      )}
    </div>
  );
}
