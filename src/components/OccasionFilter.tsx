"use client";

interface OccasionFilterProps {
  occasions: readonly string[];
  active: string;
  onChange: (occasion: string) => void;
}

export default function OccasionFilter({ occasions, active, onChange }: OccasionFilterProps) {
  return (
    <div className="souv-filter">
      {occasions.map((o) => (
        <button
          key={o}
          className={`souv-chip ${o === active ? "is-active" : ""}`}
          onClick={() => onChange(o)}
          aria-pressed={o === active}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
