import { Footer } from "../components/Footer";
import { DemoNavbar } from "../components/DemoNavbar";
import { OrnamentDivider } from "../components/Ornaments";
import { BackButton, CardPacks, CreditPacks, RiskFreeCallout } from "../components/Options";
import { PageChrome } from "../components/PageChrome";

export default function PricingPage() {
  return (
    <div className="souv-route-page">
      <PageChrome variant="options" />
      <div className="opt-page opt-pricing-page">
        <DemoNavbar cartCount={0} />
        <main>
          <CardPacks />
          <OrnamentDivider />
          <CreditPacks currency="CAD" />
          <OrnamentDivider />
          <RiskFreeCallout />
          <BackButton href="/create" label="Back to options" />
        </main>
        <Footer />
      </div>
    </div>
  );
}
