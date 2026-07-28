import { FAQ } from "./components/FAQ";
import { Footer } from "./components/Footer";
import { Gallery } from "./components/Gallery";
import { Hero } from "./components/Hero";
import { HomepageScrollReset } from "./components/HomepageScrollReset";
import { HowItWorks } from "./components/HowItWorks";
import { Navbar } from "./components/Navbar";
import { OrnamentDivider } from "./components/Ornaments";
import { PageChrome } from "./components/PageChrome";

export default function LandingPage() {
  return (
    <div className="souv-route-page">
      <HomepageScrollReset />
      <PageChrome variant="landing" />
      <Navbar followUserOnScroll />
      <main>
        <Hero accentMetal="silver" />
        <OrnamentDivider />
        <Gallery />
        <OrnamentDivider />
        <HowItWorks />
        <OrnamentDivider />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
