export const dynamic = 'force-dynamic';
export const dynamicParams = true;

import ResultsPageClient from "./ResultsPageClient";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function ResultsPage({ params }: PageProps) {
  const { locale, id } = await params;
  return <ResultsPageClient locale={locale} caseId={id} />;
}
