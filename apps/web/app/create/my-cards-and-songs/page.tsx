import { MyCardsApp } from '../../components/MyCards';
import { PageChrome } from '../../components/PageChrome';

export default function MyCardsAndSongsPage() {
  return (
    <div className="souv-route-page">
      <PageChrome variant="bmc" />
      <main className="bmc-page">
        <MyCardsApp full />
      </main>
    </div>
  );
}
