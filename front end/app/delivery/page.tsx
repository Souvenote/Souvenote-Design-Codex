import { DeliveryApp } from "../components/Delivery";
import { PageChrome } from "../components/PageChrome";
import { demoUser } from "../components/DemoUser";

export default function DeliveryPage() {
  return (
    <div className="souv-route-page">
      <PageChrome variant="bmc" />
      <main className="bmc-page"><DeliveryApp user={demoUser} /></main>
    </div>
  );
}
