"use client";

import { ControlButton } from "./Controls";
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
  patternConstraint: PatternConstraint;
  onPatternConstraintChange: (c: PatternConstraint) => void;
};

const LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

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

  return (
    <div className="flex w-full min-w-0 flex-col gap-5 text-left">
      <div
        className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3"
        role="group"
        aria-label="Pattern length mode"
      >
        <span className="text-[10px] font-normal uppercase tracking-[0.18em] text-ds-soft">
          Phase timing
        </span>
        <div className="flex flex-wrap gap-2">
          <ControlButton
            type="button"
            variant={patternConstraint === "fitTotal" ? "primary" : "secondary"}
            className="!min-h-10 !min-w-0 shrink-0 py-2.5 sm:py-3"
            aria-pressed={patternConstraint === "fitTotal"}
            onClick={() => onPatternConstraintChange("fitTotal")}
          >
            Scale to session
          </ControlButton>
          <ControlButton
            type="button"
            variant={patternConstraint === "fixed" ? "primary" : "secondary"}
            className="!min-h-10 !min-w-0 shrink-0 py-2.5 sm:py-3"
            aria-pressed={patternConstraint === "fixed"}
            onClick={() => onPatternConstraintChange("fixed")}
          >
            Fixed lengths
          </ControlButton>
        </div>
      </div>

      <div className="space-y-4">
        {slots.map((slot, idx) => {
          const letter = LETTERS[idx] ?? String(idx + 1);
          return (
            <div
              key={idx}
              className="rounded-lg border border-ds-divider/80 bg-ds-section/15 px-3 py-4 sm:px-4"
            >
              <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
                <p className="flex h-9 min-w-0 items-center rounded-md border border-ds-divider bg-ds-page px-3 font-mono text-sm tabular-nums tracking-[0.12em] text-ds-fg">
                  {letter}
                </p>
                {slots.length > 1 ? (
                  <ControlButton
                    type="button"
                    variant="secondary"
                    className="!min-h-9 !min-w-[5.5rem] shrink-0 py-2"
                    aria-label={`Remove phase ${letter}`}
                    onClick={() => removePhase(idx)}
                  >
                    Remove
                  </ControlButton>
                ) : null}
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2">
                <NumberInput
                  layout="fill"
                  labelAlign="start"
                  label="Minutes"
                  value={slot.minutes}
                  min={0}
                  max={999}
                  onChange={(v) => applyPhase(idx, v, slot.secondsPart)}
                />
                <NumberInput
                  layout="fill"
                  labelAlign="start"
                  label="Seconds"
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
            </div>
          );
        })}
      </div>

      {slots.length < MAX_PATTERN_PHASES && (
        <ControlButton
          type="button"
          variant="secondary"
          className="!min-h-10 w-full py-3"
          onClick={addPhase}
        >
          Add phase ({LETTERS[slots.length] ?? "?"}…)
        </ControlButton>
      )}
    </div>
  );
}
