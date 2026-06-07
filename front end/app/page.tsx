import { FAQ } from "./components/FAQ";
import { Footer } from "./components/Footer";
import { Gallery } from "./components/Gallery";
import { Hero } from "./components/Hero";
import { HowItWorks } from "./components/HowItWorks";
import { Navbar } from "./components/Navbar";
import { OrnamentDivider } from "./components/Ornaments";
import { PageChrome } from "./components/PageChrome";

export default function LandingLoggedOutPage() {
  return (
    <div className="souv-route-page">
      <PageChrome variant="landing" />
      <Navbar loggedIn={false} />
      <Hero accentMetal="silver" loggedIn={false} />
      <OrnamentDivider />
      <Gallery />
      <OrnamentDivider />
      <HowItWorks />
      <OrnamentDivider />
      <FAQ />
      <Footer />
    </div>
  );
}
