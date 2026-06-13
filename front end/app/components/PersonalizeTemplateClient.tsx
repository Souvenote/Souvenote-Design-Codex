"use client";

import * as React from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { PageChrome } from "./PageChrome";
import { PersonalizeApp } from "./Personalize";
import { demoUser } from "./DemoUser";
import { useDemoBalance } from "./DemoBalance";

export function PersonalizeTemplateClient() {
  const [openModal, setOpenModal] = React.useState(false);
  const demoBalance = useDemoBalance();

  React.useEffect(() => {
    setOpenModal(new URLSearchParams(window.location.search).get("modal") === "1");
  }, []);

  return (
    <div className="souv-route-page">
      <PageChrome variant="personalize" />
      <Navbar loggedIn user={demoUser} credits={demoBalance.credits} cardBank={demoBalance.cardBank} cartCount={0} />
      <main><PersonalizeApp openModal={openModal} accountBalance={demoBalance} /></main>
      <Footer />
    </div>
  );
}
