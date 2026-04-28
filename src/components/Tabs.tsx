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
    <div
      className="flex border-b border-pulse-border"
      role="tablist"
      aria-label="Pulse Timer tools"
    >
      {TABS.map(({ id, label }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            id={`tab-${id}`}
            className={`flex-1 py-3 px-2 text-[0.8125rem] font-medium uppercase tracking-[0.08em] transition-colors duration-150 ease-out border-b-2 outline-none rounded-t-lg focus-visible:ring-2 focus-visible:ring-pulse-accent focus-visible:ring-offset-2 focus-visible:ring-offset-pulse-bg ${
              isActive
                ? "text-pulse-accent border-pulse-accent shadow-[inset_0_-1px_0_0_#6c63ff]"
                : "text-pulse-muted border-transparent hover:text-pulse-text"
            }`}
            onClick={() => onChange(id)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
