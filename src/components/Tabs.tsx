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
      <div role="tablist" className="flex w-full justify-center sm:justify-start gap-6 sm:gap-10 border-b border-ds-divider/50">
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
                `relative pb-4 pt-2 outline-none transition-colors duration-ds ` +
                `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-fg-muted)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--color-bg-page)] rounded-sm ` +
                (isActive
                  ? "text-ds-fg"
                  : "text-ds-soft hover:text-ds-fg")
              }
              onClick={() => onChange(id)}
            >
              <span className={`block text-[11px] uppercase tracking-[0.15em] sm:text-[12px] ${isActive ? "font-medium" : "font-normal"}`}>
                {label}
              </span>
              {isActive && (
                <span className="absolute -bottom-[1px] left-0 right-0 h-[1px] bg-ds-soft" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
