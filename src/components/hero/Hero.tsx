import { MusicPreviewButton } from "@/components/hero/MusicPreviewButton";
import { Button } from "@/components/ui/Button";

function HeroFlipCard() {
  return (
    <div className="souv-flipcard souv-flipcard-spin">
      <div className="souv-flipcard-inner">
        <div className="souv-flipcard-face souv-flipcard-front">
          <div className="souv-flipcard-back-stack">
            <div className="souv-flipcard-mainlogo-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/MainLogo.png" alt="Souvenote" />
            </div>
          </div>
          <MusicPreviewButton label="Preview Souvenote theme" />
        </div>
        <div className="souv-flipcard-face souv-flipcard-back">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/hero-card-moon.jpg" alt="I love you to the moon and back" className="souv-flipcard-art" />
          <MusicPreviewButton label="Preview card song" />
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="souv-hero">
      <div className="souv-hero-halo souv-hero-halo-2" />
      <div className="souv-hero-inner">
        <div className="souv-hero-copy">
          <h1 className="souv-hero-title">
            <span className="souv-hero-italic text-metallic-silver">A card</span>{" "}
            <span
              className="souv-hero-italic text-metallic-gold"
              style={{ textShadow: "0 0 20px rgba(241,208,116,.42), 0 0 40px rgba(212,175,55,.2)" }}
            >
              worth
            </span>
            <br />
            <span className="souv-hero-italic text-metallic-rose-gold">keeping</span>
          </h1>
          <div className="souv-hero-ctas">
            <Button href="/signup" variant="gold">Start for Free</Button>
            <Button href="/login" variant="ghost">Log In</Button>
          </div>
          <p className="souv-hero-lede">
            Generate personalized cards and custom songs. Because the card you send should be as unique as they are.
          </p>
          <p className="souv-hero-trial">Includes 1 free image generation and 1 free song</p>
        </div>

        <div className="souv-hero-stack">
          <HeroFlipCard />
        </div>
      </div>
    </section>
  );
}
