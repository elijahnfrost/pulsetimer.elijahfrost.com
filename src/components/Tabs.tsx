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
              `flex-1 px-5 pb-0 pt-3.5 transition-colors duration-ds sm:px-7 sm:pt-4 ` +
              `outline-none border-0 border-b-2 focus-visible:border-ds-hover ` +
              `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)] ` +
              (isActive
                ? "border-ds-fg bg-ds-section/55 text-ds-fg"
                : "border-transparent bg-transparent text-ds-soft hover:text-ds-fg hover:bg-ds-section/25")
            }
            onClick={() => onChange(id)}
          >
            <span className="block text-[10px] uppercase tracking-[0.15em] sm:text-[11px] sm:tracking-[0.16em]">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
