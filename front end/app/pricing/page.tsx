import { Footer } from "../components/Footer";
import { Navbar } from "../components/Navbar";
import { OrnamentDivider } from "../components/Ornaments";
import { BackButton, CardPacks, CreditPacks } from "../components/Options";
import { PageChrome } from "../components/PageChrome";

const user = { name: "Cameron Wilson", email: "cameron@souvenote.com", initials: "CW" };
const credits = { images: 7, songs: 3 };

export default function PricingPage() {
  return (
    <div className="souv-route-page">
      <PageChrome variant="options" />
      <div className="opt-page opt-pricing-page">
        <Navbar loggedIn user={user} credits={credits} cartCount={0} />
        <CardPacks currency="CAD" />
        <OrnamentDivider />
        <CreditPacks currency="CAD" />
        <BackButton href="/create" label="Back to options" />
        <Footer />
      </div>
    </div>
  );
}
