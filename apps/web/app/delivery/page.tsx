import { Suspense } from 'react';

import { DeliveryApp } from '../components/Delivery';
import { PageChrome } from '../components/PageChrome';

export default function DeliveryPage() {
  return (
    <div className="souv-route-page">
      <PageChrome variant="bmc" />
      <main className="bmc-page">
        <Suspense fallback={<div className="bmc-status">Loading your approved card…</div>}>
          <DeliveryApp />
        </Suspense>
      </main>
    </div>
  );
}
