import type { Metadata } from "next";
import { ReferralClaimPage } from "../../components/ReferralClaimPage";
import { StaticPageChrome } from "../../components/StaticPageChrome";

export const metadata: Metadata = {
  title: "Your Souvenote Invite",
  description: "Claim a private Souvenote referral invite.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

type ReferralPageProps = { params: Promise<{ token: string }> };

export default async function ReferralPage({ params }: ReferralPageProps) {
  const { token } = await params;
  return (
    <StaticPageChrome pageClass="bmc-page">
      <ReferralClaimPage token={token} />
    </StaticPageChrome>
  );
}
