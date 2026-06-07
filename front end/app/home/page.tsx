import { FAQ } from "../components/FAQ";
import { Footer } from "../components/Footer";
import { Gallery } from "../components/Gallery";
import { Hero } from "../components/Hero";
import { HowItWorks } from "../components/HowItWorks";
import { Navbar } from "../components/Navbar";
import { OrnamentDivider } from "../components/Ornaments";
import { PageChrome } from "../components/PageChrome";

const user = { name: "Cameron Wilson", email: "cameron@souvenote.com", initials: "CW" };
const credits = { images: 7, songs: 3 };

export default function LandingLoggedInPage() {
  return (
    <div className="souv-route-page">
      <PageChrome variant="landing" />
      <Navbar loggedIn user={user} credits={credits} cardBank={1} cartCount={1} />
      <Hero accentMetal="silver" loggedIn />
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
