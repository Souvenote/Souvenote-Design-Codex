import { StaticPageChrome } from "../../components/StaticPageChrome";
import { RedeemGiftPage } from "../../components/AccountForms";

export default function GiftRedeemRoutePage() {
  return (
    <StaticPageChrome pageClass="bmc-page">
      <Suspense fallback={null}><RedeemGiftPage sender="A friend" /></Suspense>
    </StaticPageChrome>
  );
}
import { Suspense } from "react";
