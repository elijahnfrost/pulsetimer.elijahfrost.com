"use client";

import type { CSSProperties } from "react";
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

/** Mask: feather toward the inner end edge (solid at panel edge, fade toward inputs) */
const phaseRailMaskStyle: CSSProperties = {
  WebkitMaskImage: "linear-gradient(90deg, #000 0%, #000 78%, transparent 100%)",
  maskImage: "linear-gradient(90deg, #000 0%, #000 78%, transparent 100%)",
};

const reorderBtnClass =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded border border-transparent text-[13px] leading-none text-ds-soft transition-colors duration-ds sm:h-11 sm:w-11 sm:text-[14px] " +
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
        <div className="relative overflow-hidden rounded-md border border-ds-divider bg-ds-page" dir="ltr">
          {slots.map((slot, idx) => {
            const letter = LETTERS[idx] ?? String(idx + 1);
            const canReorder = slots.length > 1;
            return (
              <div
                key={idx}
                className={`group relative isolate flex min-h-[8rem] flex-nowrap items-center justify-start gap-x-2.5 py-2.5 ps-[8rem] pe-3 sm:min-h-[9.75rem] sm:gap-x-3.5 sm:ps-[9.5rem] sm:pe-4 ${idx < slots.length - 1 ? "border-b border-ds-divider" : ""}`}
              >
                <div
                  className="pointer-events-none absolute inset-y-0 start-0 z-0 w-[8rem] opacity-[0.92] transition-opacity duration-300 ease-out group-hover:opacity-100 sm:w-[9.5rem]"
                  aria-hidden
                >
                  <div
                    className="h-full w-full bg-gradient-to-r from-ds-section/60 via-ds-section/35 to-transparent"
                    style={phaseRailMaskStyle}
                  />
                </div>

                <span
                  className="absolute inset-y-0 start-0 z-[1] flex w-[8rem] -translate-x-5 items-center justify-start bg-[linear-gradient(90deg,transparent_0%,var(--color-fg)_42%,var(--color-fg)_100%)] bg-clip-text ps-0 font-sans text-[calc(8rem-0.88rem)] font-[100] tabular-nums leading-none tracking-[-0.06em] text-transparent antialiased [font-feature-settings:'kern'_1,'liga'_1] [text-rendering:geometricPrecision] sm:w-[9.5rem] sm:-translate-x-6 sm:text-[calc(9.75rem-1rem)]"
                  aria-label={`Phase ${letter}`}
                >
                  {letter}
                </span>

                <div className="relative z-10 flex min-w-0 flex-1 flex-nowrap items-center gap-x-2.5 sm:gap-x-3">
                  {canReorder ? (
                    <div className="relative z-10 flex shrink-0 flex-col gap-1.5">
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
                    density="dense"
                    grow
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

                <div className="relative z-10 ml-auto flex shrink-0 items-center ps-4 sm:ps-8">
                  {slots.length > 1 ? (
                    <button
                      type="button"
                      className="inline-flex min-h-[2.875rem] items-center justify-center border-b border-transparent px-2 py-2 font-sans text-[12px] font-[100] uppercase tracking-[0.14em] text-ds-body transition-[color,border-color] duration-ds ease-ds-out hover:border-ds-soft/55 hover:text-ds-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)] sm:min-h-11 sm:text-[13px] sm:tracking-[0.15em]"
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
              className="flex min-h-[2.875rem] w-full items-center justify-center gap-x-1.5 border-t border-ds-divider bg-ds-page px-4 py-3 font-sans text-[10px] font-[100] uppercase tracking-[0.17em] text-ds-soft transition-colors duration-ds hover:bg-ds-section/40 hover:text-ds-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)] sm:min-h-12 sm:text-[11px] sm:tracking-[0.16em]"
              onClick={addPhase}
            >
              Add phase
              <span className="tabular-nums opacity-[0.82]" aria-hidden>
                ({LETTERS[slots.length] ?? "?"}…)
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
