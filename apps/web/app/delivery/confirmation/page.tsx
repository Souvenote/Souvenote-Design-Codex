import { Suspense } from 'react';
import { DeliveryConfirmationApp } from '../../components/DeliveryConfirmation';

export default function DeliveryConfirmationPage() {
  return (
    <Suspense fallback={<div className="bmc-status">Loading confirmation…</div>}>
      <DeliveryConfirmationApp />
    </Suspense>
  );
}
