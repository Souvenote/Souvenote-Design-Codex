import { HostedCheckoutTest } from '../../../components/HostedCheckoutTest';
import { PageChrome } from '../../../components/PageChrome';

type CheckoutPageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ variant?: string }>;
};

export default async function CheckoutPage({ params, searchParams }: CheckoutPageProps) {
  const [{ sessionId }, query] = await Promise.all([params, searchParams]);
  const variant = query.variant === 'blank_handoff' ? 'blank_handoff' : 'personalized';
  return (
    <div className="souv-route-page">
      <PageChrome variant="bmc" />
      <div className="bmc-page">
        <HostedCheckoutTest sessionId={sessionId} variant={variant} />
      </div>
    </div>
  );
}
