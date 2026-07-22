import { DeliveryApp } from '../components/Delivery';
import { PageChrome } from '../components/PageChrome';

export default function DeliveryPage() {
  return (
    <div className="souv-route-page">
      <PageChrome variant="bmc" />
      <main className="bmc-page">
        <DeliveryApp />
      </main>
    </div>
  );
}
