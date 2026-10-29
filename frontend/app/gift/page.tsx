import { AccountRouteClient } from "../components/AccountRouteClient";
import { GiftSouvenotePage } from "../components/AccountForms";
import { demoUser } from "../components/DemoUser";

export default function GiftRoutePage() {
  return <AccountRouteClient><GiftSouvenotePage user={demoUser} /></AccountRouteClient>;
}
