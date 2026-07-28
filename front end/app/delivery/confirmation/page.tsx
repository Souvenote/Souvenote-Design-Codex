import { DeliveryConfirmationApp } from "../../components/DeliveryConfirmation";

type DeliveryConfirmationPageProps = {
  searchParams: Promise<{
    orderId?: string | string[];
  }>;
};

const ORDER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function DeliveryConfirmationPage({
  searchParams,
}: DeliveryConfirmationPageProps) {
  const params = await searchParams;
  const candidate = Array.isArray(params.orderId)
    ? params.orderId[0]
    : params.orderId;
  const initialOrderId =
    typeof candidate === "string" && ORDER_ID_PATTERN.test(candidate)
      ? candidate.toLowerCase()
      : null;

  return <DeliveryConfirmationApp initialOrderId={initialOrderId} />;
}
