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
    <nav aria-label="Pulse Timer tools" className="relative z-[1] w-full">
      <div role="tablist" className="flex w-full flex-wrap gap-2 sm:gap-2.5">
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
                `min-h-11 flex-1 rounded-md px-3 py-2.5 outline-none transition-colors duration-ds sm:min-h-12 sm:px-5 sm:py-3.5 ` +
                `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)] ` +
                (isActive
                  ? "border border-ds-fg bg-ds-fg text-ds-page"
                  : "border border-ds-divider bg-transparent text-ds-soft hover:border-ds-border hover:bg-ds-section/20 hover:text-ds-fg")
              }
              onClick={() => onChange(id)}
            >
              <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] sm:text-[12px] sm:tracking-[0.14em]">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
