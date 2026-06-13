import { Eyebrow, StampCorners } from "./Ornaments";

type Step = {
  n: string;
  t: string;
  d: string;
};

const STEPS: Step[] = [
  {
    n: "01",
    t: "Choose a moment",
    d: "Pick the occasion and tell us who it\u2019s for. Or upload a photo that tells the story for you.",
  },
  {
    n: "02",
    t: "Let AI craft the card",
    d: "Souvenote writes the words, designs the face, and composes a song\u00a0\u2014 tailored to your moment.",
  },
  {
    n: "03",
    t: "Print, send, keep",
    d: "Order and send the physical card to their door for as little as $6.99\u00a0\u2014 or save it for a rainy day.",
  },
];

function HowItWorks() {
  return (
    <section className="souv-steps">
      <div className="souv-steps-head">
        <Eyebrow>How it works</Eyebrow>
        <h2 className="souv-h1">
          <span className="souv-hero-italic text-metallic-silver">Three steps,</span>{" "}
          <span className="souv-hero-italic text-metallic-rose-gold">one keepsake</span>
        </h2>
      </div>
      <div className="souv-steps-grid">
        {STEPS.map((step) => (
          <div key={step.n} className="souv-step-card">
            <StampCorners />
            <div className="souv-step-num">{step.n}</div>
            <div className="souv-step-title">{step.t}</div>
            <div className="souv-step-body">{step.d}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export { HowItWorks };
