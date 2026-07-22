import { StaticPageChrome } from '../../components/StaticPageChrome';
import { RedeemGiftPage } from '../../components/AccountForms';

export default function GiftRedeemRoutePage() {
  return (
    <StaticPageChrome pageClass="bmc-page">
      <RedeemGiftPage sender="A friend" />
    </StaticPageChrome>
  );
}
