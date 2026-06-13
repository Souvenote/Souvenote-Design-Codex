"use client";

import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { PageChrome } from "./PageChrome";
import { CartPage } from "./CartPage";
import { demoUser } from "./DemoUser";
import { useDemoBalance } from "./DemoBalance";

export function CartRouteClient() {
  const demoBalance = useDemoBalance();

  return (
    <div className="souv-route-page">
      <PageChrome variant="bmc" />
      <div className="bmc-page">
        <Navbar loggedIn user={demoUser} credits={demoBalance.credits} cardBank={demoBalance.cardBank} cartCount={0} />
        <main><CartPage /></main>
        <Footer />
      </div>
    </div>
  );
}
