type PageChromeVariant = "landing" | "auth" | "options";

type PageChromeProps = {
  variant?: PageChromeVariant;
};

const gemClasses = [
  "souv-gem g1",
  "souv-gem is-rose g2",
  "souv-gem is-silver g3",
  "souv-gem g4",
  "souv-gem is-rose g5",
  "souv-gem is-silver g6",
  "souv-gem g7",
  "souv-gem is-silver g8",
];

export function PageChrome({ variant = "landing" }: PageChromeProps) {
  const haloClass = variant === "auth" ? "auth-halo" : variant === "options" ? "opt-page-halo" : "souv-page-halo";
  const gems = variant === "auth" ? gemClasses.slice(0, 7) : gemClasses;

  return (
    <>
      <div className={haloClass} aria-hidden="true" />
      <div className="souv-sparkles" aria-hidden="true" />
      <div className="souv-gems" aria-hidden="true">
        {gems.map((className) => (
          <span key={className} className={className} />
        ))}
      </div>
      <div className="souv-grain" aria-hidden="true" />
    </>
  );
}
