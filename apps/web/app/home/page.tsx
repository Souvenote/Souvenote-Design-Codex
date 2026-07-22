import { FAQ } from '../components/FAQ';
import { Footer } from '../components/Footer';
import { Gallery } from '../components/Gallery';
import { Hero } from '../components/Hero';
import { HowItWorks } from '../components/HowItWorks';
import { DemoNavbar } from '../components/DemoNavbar';
import { OrnamentDivider } from '../components/Ornaments';
import { PageChrome } from '../components/PageChrome';

export default function LandingLoggedInPage() {
  return (
    <div className="souv-route-page">
      <PageChrome variant="landing" />
      <DemoNavbar cartCount={1} followUserOnScroll />
      <main>
        <Hero accentMetal="silver" loggedIn />
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
