import { MyCardsApp } from '../../components/MyCards';
import { PageChrome } from '../../components/PageChrome';
import { demoUser } from '../../components/DemoUser';

export default function MyCardsAndSongsPage() {
  return (
    <div className="souv-route-page">
      <PageChrome variant="bmc" />
      <main className="bmc-page">
        <MyCardsApp user={demoUser} full />
      </main>
    </div>
  );
}
