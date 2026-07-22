import { AccountRouteClient } from '../../components/AccountRouteClient';
import { ProfilePage } from '../../components/AccountPages';
import { demoUser } from '../../components/DemoUser';

export default function ProfileRoutePage() {
  return (
    <AccountRouteClient>
      <ProfilePage user={demoUser} />
    </AccountRouteClient>
  );
}
