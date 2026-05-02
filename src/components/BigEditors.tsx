"use client";

import type { CSSProperties, Ref } from "react";
import { useEffect, useRef, useState } from "react";

export const phaseRailMaskStyle: CSSProperties = {
  WebkitMaskImage: "linear-gradient(90deg, #000 0%, #000 78%, transparent 100%)",
  maskImage: "linear-gradient(90deg, #000 0%, #000 78%, transparent 100%)",
};

export const letterGradient = "bg-[linear-gradient(90deg,transparent_0%,var(--color-fg)_42%,var(--color-fg)_100%)]";

export const rowShellBase =
  "group relative isolate flex min-h-[5.5rem] flex-nowrap items-center gap-x-1.5 px-3 py-4 pe-3 sm:min-h-[6rem] sm:gap-x-3 sm:px-4 sm:py-4 sm:pe-4";

export type HmsSeg = "h" | "m" | "s";

/** Segment column width — matches labels row below. */
export const hmsSegGridClass = "w-[2.75rem] shrink-0 sm:w-[3rem]";
/** Narrow column for colon + label spacer so Hr/Min/Sec stay centered under digits. */
export const hmsColonTrackClass = "w-[0.5rem] shrink-0 sm:w-[0.62rem]";

export const digitShell =
  "min-h-[1.05em] min-w-[2.35ch] text-center font-mono text-[clamp(1.6rem,3.8vmin,2.1rem)] font-medium leading-none tracking-[-0.02em] text-ds-fg tabular-nums";

export const hmsEditInputClass =
  `${digitShell} z-[1] m-0 w-[3.25ch] max-w-[4rem] border-0 border-b border-ds-hover/80 bg-transparent p-0 pb-px text-ds-fg outline-none ` +
  "placeholder:text-ds-soft/50 focus-visible:border-ds-fg/40";

export const hmsReadoutBtnClass =
  `${digitShell} rounded-md px-0.5 pb-px border-b border-transparent outline-none transition-colors duration-ds ` +
  "hover:bg-ds-section/28 focus-visible:bg-ds-section/28 focus-visible:ring-2 focus-visible:ring-[var(--color-fg-muted)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-page)]";

export type HmsColumnProps = {
  padded: string;
  phaseLetter: string;
  editing: boolean;
  draft: string;
  onDraftChange: (next: string) => void;
  onOpen: () => void;
  onCommit: () => void;
  onCancel: () => void;
  inputRef: Ref<HTMLInputElement>;
};

export function HmsColumn({
  padded,
  phaseLetter,
  editing,
  draft,
  onDraftChange,
  onOpen,
  onCommit,
  onCancel,
  inputRef,
}: HmsColumnProps) {
  const unitShort = "Unit"; // We can derive this if needed, or just use a generic label

  return (
    <div className={`${hmsSegGridClass} flex flex-col items-center gap-0 px-0`}>
      <div className="relative flex h-[3.5rem] w-full items-center justify-center">
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
    </div>
  );
}

export type HmsClockProps = {
  phaseLetter: string;
  hours: number;
  minutes: number;
  seconds: number;
  onSetHms: (hours: number, minutes: number, secondsPart: number) => void;
};

/**
 * Large HH:MM:SS readout; no outer frame. Click digits to type that unit (overflow normalizes).
 */
export function HmsClock({
  phaseLetter,
  hours,
  minutes,
  seconds,
  onSetHms,
}: HmsClockProps) {
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

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
    <div className="flex flex-col items-center gap-0.5 pl-2 sm:pl-4" role="group" aria-label={`Phase ${phaseLetter} duration ${hh} ${mm} ${ss}`}>
      <div className="flex items-center justify-center">
        <HmsColumn
          padded={hh}
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
          padded={mm}
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
          padded={ss}
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

export type BigNumberProps = {
  label: string;
  value: number;
  onChange: (val: number) => void;
  unitLabel: string;
};

export function BigNumber({ label, value, onChange, unitLabel }: BigNumberProps) {
  const padded = String(value).padStart(2, "0");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const openSeg = () => {
    setEditing(true);
    setDraft(String(value));
  };

  const cancelSeg = () => {
    setEditing(false);
    setDraft("");
  };

  const commitSeg = () => {
    const t = draft.trim();
    setEditing(false);
    setDraft("");
    if (t === "") return;
    const n = Number.parseInt(t, 10);
    if (!Number.isFinite(n) || n < 0) return;
    onChange(n);
  };

  const labelRowClass =
    "text-[8px] font-medium uppercase leading-none tracking-[0.14em] text-ds-soft/90 sm:text-[9px] sm:tracking-[0.16em]";

  return (
    <div className="flex flex-col items-center gap-0.5 pl-2 sm:pl-4" role="group" aria-label={`${label} ${value}`}>
      <div className="flex items-center justify-center">
        <HmsColumn
          padded={padded}
          phaseLetter={label}
          editing={editing}
          draft={draft}
          onDraftChange={setDraft}
          onOpen={openSeg}
          onCommit={commitSeg}
          onCancel={cancelSeg}
          inputRef={inputRef}
        />
      </div>
      <div className="flex justify-center pt-px" aria-hidden>
        <span className={`${hmsSegGridClass} flex justify-center`}>
          <span className={labelRowClass}>{unitLabel}</span>
        </span>
      </div>
    </div>
  );
}
