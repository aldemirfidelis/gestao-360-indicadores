import { CompanyCareersPage } from '@/components/recruitment/company-careers-page';

export default async function CompanyCareersRoute({ params }: { params: Promise<{ empresa: string }> }) {
  const { empresa } = await params;
  return <CompanyCareersPage empresa={decodeURIComponent(empresa)} />;
}
