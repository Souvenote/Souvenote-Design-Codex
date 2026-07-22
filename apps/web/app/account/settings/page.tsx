import { AccountRouteClient } from "../../components/AccountRouteClient";
import { SettingsPage } from "../../components/AccountForms";
import { demoUser } from "../../components/DemoUser";

export default function SettingsRoutePage() {
  return <AccountRouteClient><SettingsPage user={demoUser} /></AccountRouteClient>;
}
