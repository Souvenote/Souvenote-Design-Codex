import { AccountRouteClient } from "../components/AccountRouteClient";
import { ReferPage } from "../components/AccountPages";
import { demoUser } from "../components/DemoUser";

export default function ReferRoutePage() {
  return <AccountRouteClient><ReferPage user={demoUser} /></AccountRouteClient>;
}
