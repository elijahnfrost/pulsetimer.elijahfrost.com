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
      <div role="tablist" className="grid w-full grid-cols-3 gap-0">
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
                `flex min-h-[2.5rem] items-center justify-center border-b px-2 pb-2.5 pt-2 outline-none transition-colors duration-ds ` +
                `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-fg-muted)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-page)] ` +
                (isActive
                  ? "border-ds-bright text-ds-bright"
                  : "border-ds-divider/35 text-ds-soft hover:text-ds-fg")
              }
              onClick={() => onChange(id)}
            >
              <span
                className={`block text-center text-[11px] uppercase tracking-[0.18em] sm:text-[12px] sm:tracking-[0.16em] ${
                  isActive ? "font-medium" : "font-normal"
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
