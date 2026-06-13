import type { ReactNode } from "react";
import { DemoNavbar } from "./DemoNavbar";
import { Footer } from "./Footer";
import { PageChrome } from "./PageChrome";

type AccountRouteClientProps = {
  children: ReactNode;
};

export function AccountRouteClient({ children }: AccountRouteClientProps) {
  return (
    <div className="souv-route-page">
      <PageChrome variant="bmc" />
      <div className="bmc-page">
        <DemoNavbar cartCount={0} />
        <main>{children}</main>
        <Footer />
      </div>
    </div>
  );
}
