// Ornaments.jsx — shared primitives for the Souvenote UI

function OrnamentDivider({ className = '' }) {
  return (
    <div className={`souv-orn ${className}`}>
      <span className="r" /><span className="d" /><span className="r" />
    </div>
  );
}

function RuleGold({ style }) {
  return <div className="souv-rule-gold" style={style} />;
}

function StampCorners({ color = 'rgba(212,175,55,0.55)' }) {
  const base = {
    position: 'absolute', width: 28, height: 28, borderColor: color,
    pointerEvents: 'none',
  };
  return (
    <>
      <span style={{ ...base, top: 12, left: 12, borderTop: '2px solid', borderLeft: '2px solid' }} />
      <span style={{ ...base, top: 12, right: 12, borderTop: '2px solid', borderRight: '2px solid' }} />
      <span style={{ ...base, bottom: 12, left: 12, borderBottom: '2px solid', borderLeft: '2px solid' }} />
      <span style={{ ...base, bottom: 12, right: 12, borderBottom: '2px solid', borderRight: '2px solid' }} />
    </>
  );
}

function Eyebrow({ children, style }) {
  return <div className="souv-eyebrow" style={style}>{children}</div>;
}

export { OrnamentDivider, RuleGold, StampCorners, Eyebrow };
