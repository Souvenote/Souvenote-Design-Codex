"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FAQ } from "../components/FAQ";
import { Footer } from "../components/Footer";
import { Gallery } from "../components/Gallery";
import { Hero } from "../components/Hero";
import { HomepageScrollReset } from "../components/HomepageScrollReset";
import { HowItWorks } from "../components/HowItWorks";
import { DemoNavbar } from "../components/DemoNavbar";
import { OrnamentDivider } from "../components/Ornaments";
import { PageChrome } from "../components/PageChrome";
import { useAuth } from "../components/AuthProvider";

export default function LandingLoggedInPage() {
  const auth = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (auth.status === "unauthenticated" || auth.status === "error") {
      router.replace("/login?returnTo=%2Fhome");
    }
  }, [auth.status, router]);

  if (auth.status !== "authenticated") {
    return (
      <div className="souv-route-page">
        <PageChrome variant="landing" />
        <main>
          <div className="bmc-shell" aria-live="polite">
            <p className="bmc-lede">Checking your Souvenote session...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="souv-route-page">
      <HomepageScrollReset />
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
