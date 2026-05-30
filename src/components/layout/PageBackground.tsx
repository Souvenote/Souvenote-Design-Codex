// Ambient page background — fixed sparkle field, diamond flares, grain + halo.
export function PageBackground() {
  return (
    <>
      <div className="souv-page-halo" />
      <div className="souv-sparkles" />
      <div className="souv-gems">
        <span className="souv-gem g1" />
        <span className="souv-gem is-rose g2" />
        <span className="souv-gem is-silver g3" />
        <span className="souv-gem g4" />
        <span className="souv-gem is-rose g5" />
        <span className="souv-gem is-silver g6" />
        <span className="souv-gem g7" />
        <span className="souv-gem is-silver g8" />
      </div>
      <div className="souv-grain" />
    </>
  );
}
