"use client";

import type { CSSProperties, Ref } from "react";
import { useEffect, useRef, useState } from "react";
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
  "group relative isolate flex min-h-[4.5rem] flex-nowrap items-center gap-x-1.5 px-3 py-2 ps-[calc(6.5rem+0.125rem)] pe-3 sm:min-h-[5rem] sm:gap-x-3 sm:px-4 sm:py-2 sm:ps-[calc(7.75rem+0.25rem)] sm:pe-4";

type HmsSeg = "h" | "m" | "s";

/** Hover-only on fine pointers: arrows hidden until pointer is over the column (no focus-within — avoids sticky visibility after click). */
const segArrowShow = {
  hcol:
    "opacity-100 transition-opacity duration-150 ease-out motion-reduce:transition-none " +
    "[@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:opacity-0 " +
    "[@media(hover:hover)]:group-hover/hcol:pointer-events-auto [@media(hover:hover)]:group-hover/hcol:opacity-100 " +
    "[@media(hover:hover)]:group-hover/hcol:disabled:opacity-[0.34]",
  mcol:
    "opacity-100 transition-opacity duration-150 ease-out motion-reduce:transition-none " +
    "[@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:opacity-0 " +
    "[@media(hover:hover)]:group-hover/mcol:pointer-events-auto [@media(hover:hover)]:group-hover/mcol:opacity-100 " +
    "[@media(hover:hover)]:group-hover/mcol:disabled:opacity-[0.34]",
  scol:
    "opacity-100 transition-opacity duration-150 ease-out motion-reduce:transition-none " +
    "[@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:opacity-0 " +
    "[@media(hover:hover)]:group-hover/scol:pointer-events-auto [@media(hover:hover)]:group-hover/scol:opacity-100 " +
    "[@media(hover:hover)]:group-hover/scol:disabled:opacity-[0.34]",
} as const;

const segArrowBtn =
  "flex h-8 min-h-8 w-full max-w-none items-center justify-center rounded-md text-sm font-semibold leading-none text-ds-muted " +
  "transition-[color,background-color,opacity] duration-ds hover:bg-ds-section/45 hover:text-ds-fg active:bg-ds-section/55 " +
  "disabled:pointer-events-none disabled:text-ds-soft/45 disabled:hover:bg-transparent " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-fg-muted)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-page)]";

/** Segment column width — matches labels row below. */
const hmsSegGridClass = "w-[2.75rem] shrink-0 sm:w-[3rem]";
/** Narrow column for colon + label spacer so Hr/Min/Sec stay centered under digits. */
const hmsColonTrackClass = "w-[0.5rem] shrink-0 sm:w-[0.62rem]";

const digitShell =
  "min-h-[1.05em] min-w-[2.35ch] text-center font-mono text-[clamp(1.6rem,3.8vmin,2.1rem)] font-medium leading-none tracking-[-0.02em] text-ds-fg tabular-nums";

const hmsEditInputClass =
  `${digitShell} z-[1] m-0 w-[3.25ch] max-w-[4rem] border-0 border-b border-ds-hover/80 bg-transparent p-0 pb-px text-ds-fg outline-none ` +
  "placeholder:text-ds-soft/50 focus-visible:border-ds-fg/40";

const hmsReadoutBtnClass =
  `${digitShell} rounded-md px-0.5 outline-none transition-colors duration-ds ` +
  "hover:bg-ds-section/28 focus-visible:bg-ds-section/28 focus-visible:ring-2 focus-visible:ring-[var(--color-fg-muted)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-page)]";

type HmsColumnProps = {
  groupClass: "group/hcol" | "group/mcol" | "group/scol";
  arrowShow: string;
  padded: string;
  decLabel: string;
  incLabel: string;
  onDec: () => void;
  onInc: () => void;
  decDisabled: boolean;
  incDisabled: boolean;
  atCap: boolean;
  phaseLetter: string;
  editing: boolean;
  draft: string;
  onDraftChange: (next: string) => void;
  onOpen: () => void;
  onCommit: () => void;
  onCancel: () => void;
  inputRef: Ref<HTMLInputElement>;
};

function HmsColumn({
  groupClass,
  arrowShow,
  padded,
  decLabel,
  incLabel,
  onDec,
  onInc,
  decDisabled,
  incDisabled,
  atCap,
  phaseLetter,
  editing,
  draft,
  onDraftChange,
  onOpen,
  onCommit,
  onCancel,
  inputRef,
}: HmsColumnProps) {
  const unitShort = incLabel.includes("hours") ? "Hr" : incLabel.includes("minutes") ? "Min" : "Sec";

  return (
    <div
      className={`${groupClass} ${hmsSegGridClass} flex flex-col items-center gap-0 px-0 pt-1`}
      onMouseLeave={(e) => {
        const root = e.currentTarget;
        const a = document.activeElement;
        if (!(a instanceof HTMLElement) || !root.contains(a)) return;
        if (a.tagName !== "BUTTON") return;
        a.blur();
      }}
    >
      <button
        type="button"
        className={`${segArrowBtn} ${arrowShow}`}
        aria-label={incLabel}
        disabled={atCap || incDisabled}
        onClick={onInc}
      >
        ▲
      </button>

      <div className="relative flex min-h-[1.05em] items-center justify-center">
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label={`${unitShort} for phase ${phaseLetter}`}
            className={hmsEditInputClass}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value.replace(/\D/g, ""))}
            onBlur={() => onCommit()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onCommit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
              }
            }}
          />
        ) : (
          <button
            type="button"
            className={hmsReadoutBtnClass}
            aria-label={`${unitShort} ${padded}. Click to type.`}
            onClick={onOpen}
          >
            {padded}
          </button>
        )}
      </div>

      <button
        type="button"
        className={`${segArrowBtn} ${arrowShow}`}
        aria-label={decLabel}
        disabled={decDisabled}
        onClick={onDec}
      >
        ▼
      </button>
    </div>
  );
}

type HmsClockProps = {
  phaseLetter: string;
  hours: number;
  minutes: number;
  seconds: number;
  totalSec: number;
  onSetHms: (hours: number, minutes: number, secondsPart: number) => void;
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
 * Large HH:MM:SS readout; no outer frame. Each column shows ↑↓ only for that column on hover (or focus-within); click digits to type that unit (overflow normalizes).
 */
function HmsClock({
  phaseLetter,
  hours,
  minutes,
  seconds,
  totalSec,
  onSetHms,
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

  const [activeSeg, setActiveSeg] = useState<HmsSeg | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeSeg && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [activeSeg]);

  const openSeg = (seg: HmsSeg, current: number) => {
    setActiveSeg(seg);
    setDraft(String(current));
  };

  const cancelSeg = () => {
    setActiveSeg(null);
    setDraft("");
  };

  const commitSeg = (seg: HmsSeg) => {
    const t = draft.trim();
    setActiveSeg(null);
    setDraft("");
    if (t === "") return;
    const n = Number.parseInt(t, 10);
    if (!Number.isFinite(n) || n < 0) return;
    if (seg === "h") onSetHms(n, minutes, seconds);
    else if (seg === "m") onSetHms(hours, n, seconds);
    else onSetHms(hours, minutes, n);
  };

  const colonClassName = `${hmsColonTrackClass} flex select-none items-center justify-center font-mono text-[clamp(1.6rem,3.8vmin,2.1rem)] font-extralight leading-none tracking-[-0.02em] text-ds-muted/60`;

  const labelRowClass =
    "text-[8px] font-medium uppercase leading-none tracking-[0.14em] text-ds-soft/90 sm:text-[9px] sm:tracking-[0.16em]";

  return (
    <div className="flex flex-col items-center gap-0.5" role="group" aria-label={`Phase ${phaseLetter} duration ${hh} ${mm} ${ss}`}>
      <div className="flex items-center justify-center">
        <HmsColumn
          groupClass="group/hcol"
          arrowShow={segArrowShow.hcol}
          padded={hh}
          decLabel={`Phase ${phaseLetter} — decrease hours`}
          incLabel={`Phase ${phaseLetter} — increase hours`}
          onDec={hourDec}
          onInc={hourInc}
          decDisabled={totalSec < 3600}
          incDisabled={hourIncBlocked}
          atCap={atCap}
          phaseLetter={phaseLetter}
          editing={activeSeg === "h"}
          draft={draft}
          onDraftChange={setDraft}
          onOpen={() => openSeg("h", hours)}
          onCommit={() => commitSeg("h")}
          onCancel={cancelSeg}
          inputRef={inputRef}
        />
        <span className={colonClassName} aria-hidden>
          :
        </span>
        <HmsColumn
          groupClass="group/mcol"
          arrowShow={segArrowShow.mcol}
          padded={mm}
          decLabel={`Phase ${phaseLetter} — decrease minutes`}
          incLabel={`Phase ${phaseLetter} — increase minutes`}
          onDec={minDec}
          onInc={minInc}
          decDisabled={totalSec < 60}
          incDisabled={minIncBlocked}
          atCap={atCap}
          phaseLetter={phaseLetter}
          editing={activeSeg === "m"}
          draft={draft}
          onDraftChange={setDraft}
          onOpen={() => openSeg("m", minutes)}
          onCommit={() => commitSeg("m")}
          onCancel={cancelSeg}
          inputRef={inputRef}
        />
        <span className={colonClassName} aria-hidden>
          :
        </span>
        <HmsColumn
          groupClass="group/scol"
          arrowShow={segArrowShow.scol}
          padded={ss}
          decLabel={`Phase ${phaseLetter} — decrease seconds`}
          incLabel={`Phase ${phaseLetter} — increase seconds`}
          onDec={secDec}
          onInc={secInc}
          decDisabled={totalSec < 1}
          incDisabled={secIncBlocked}
          atCap={atCap}
          phaseLetter={phaseLetter}
          editing={activeSeg === "s"}
          draft={draft}
          onDraftChange={setDraft}
          onOpen={() => openSeg("s", seconds)}
          onCommit={() => commitSeg("s")}
          onCancel={cancelSeg}
          inputRef={inputRef}
        />
      </div>
      <div className="flex justify-center pt-px" aria-hidden>
        <span className={`${hmsSegGridClass} flex justify-center`}>
          <span className={labelRowClass}>Hr</span>
        </span>
        <span className={hmsColonTrackClass} />
        <span className={`${hmsSegGridClass} flex justify-center`}>
          <span className={labelRowClass}>Min</span>
        </span>
        <span className={hmsColonTrackClass} />
        <span className={`${hmsSegGridClass} flex justify-center`}>
          <span className={labelRowClass}>Sec</span>
        </span>
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
                onSetHms={(h, m, s) => applyPhaseTotalSec(idx, totalSecFromHms(h, m, s))}
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
