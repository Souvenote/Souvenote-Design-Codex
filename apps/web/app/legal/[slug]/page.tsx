import { LegalPageClient } from '../../components/LegalPageClient';

type LegalRouteParams = {
  slug: string;
};

type LegalSlugPageProps = {
  params: Promise<LegalRouteParams>;
};

export function generateStaticParams(): LegalRouteParams[] {
  return ['privacy-policy', 'terms-of-service', 'refund-policy', 'cookie-policy'].map((slug) => ({ slug }));
}

export default async function LegalSlugPage({ params }: LegalSlugPageProps) {
  const { slug } = await params;
  return <LegalPageClient slug={slug} />;
}
