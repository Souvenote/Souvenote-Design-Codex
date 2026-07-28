import type { Metadata } from "next";
import { PublicSouvenotePlayer } from "../../components/PublicSouvenotePlayer";

export const metadata: Metadata = {
  title: "Your Souvenote",
  description: "Open the private song and keepsake attached to your Souvenote card.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

type ListenPageProps = {
  params: Promise<{ token: string }>;
};

export default async function ListenPage({ params }: ListenPageProps) {
  const { token } = await params;
  return <PublicSouvenotePlayer token={token} />;
}
