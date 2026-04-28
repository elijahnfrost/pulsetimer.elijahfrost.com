"use client";

export type TabKey = "interval" | "timer" | "stopwatch";

const TABS: { id: TabKey; label: string }[] = [
  { id: "interval", label: "Interval" },
  { id: "timer", label: "Timer" },
  { id: "stopwatch", label: "Stopwatch" },
];

type Props = {
  active: TabKey;
  onChange: (k: TabKey) => void;
};

export function Tabs({ active, onChange }: Props) {
  return (
    <div role="tablist" aria-label="Pulse Timer tools" className="relative z-[1] flex w-full border border-ds-border">
      {TABS.map(({ id, label }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            id={`tab-${id}`}
            className={
              `flex-1 px-3 py-3 transition-colors duration-ds sm:px-4 ` +
              `outline-none border border-transparent focus-visible:border-ds-hover ` +
              `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)] ` +
              (isActive
                ? "bg-transparent text-ds-fg"
                : "bg-transparent text-ds-soft hover:text-ds-fg hover:bg-transparent")
            }
            style={
              isActive
                ? { boxShadow: "inset 0 -2px 0 0 var(--color-fg)" }
                : { boxShadow: "none" }
            }
            onClick={() => onChange(id)}
          >
            <span className="block text-[9px] uppercase tracking-[0.2em] sm:text-[10px] sm:tracking-[0.22em]">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
