import { AccountRouteClient } from '../../components/AccountRouteClient';
import { SettingsPage } from '../../components/AccountForms';

export default function SettingsRoutePage() {
  return (
    <AccountRouteClient>
      <SettingsPage />
    </AccountRouteClient>
  );
}
