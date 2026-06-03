import { StampCorners, OrnamentDivider } from "@/components/layout/Ornaments";

const STEPS = [
  { n: "01", t: "Choose a moment", d: "Pick the occasion and tell us who it’s for. Or upload a photo that tells the story for you." },
  { n: "02", t: "Let AI craft the card", d: "Souvenote writes the words, designs the face, and composes a song — tailored to your moment." },
  { n: "03", t: "Print, send, keep", d: "Order the physical card for $11.99 CAD. Share the digital version — or save it to your library." },
];

export function HowItWorks() {
  return (
    <section className="souv-steps">
      <div className="souv-steps-head">
        <h2 className="souv-h1">
          <span className="souv-hero-italic text-metallic-silver">Three steps,</span>{" "}
          <span className="souv-hero-italic text-metallic-rose-gold">one keepsake.</span>
        </h2>
      </div>
      <div className="souv-steps-grid">
        {STEPS.map((s) => (
          <div key={s.n} className="souv-step-card">
            <StampCorners />
            <div className="souv-step-num">{s.n}</div>
            <div className="souv-step-title">{s.t}</div>
            <div className="souv-step-body">{s.d}</div>
          </div>
        ))}
      </div>
      <OrnamentDivider />
    </section>
  );
}
