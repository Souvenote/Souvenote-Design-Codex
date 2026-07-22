import { AccountRouteClient } from '../../components/AccountRouteClient';
import { ProfilePage } from '../../components/AccountPages';

export default function ProfileRoutePage() {
  return (
    <AccountRouteClient>
      <ProfilePage />
    </AccountRouteClient>
  );
}
