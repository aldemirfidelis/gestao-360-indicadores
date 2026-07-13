import { PageHeader } from '@/components/shell/page-header';
import { FacialClock } from '@/components/personnel/facial-clock';

export default function FacialClockPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Ponto Facial" description="Cadastro e registro de ponto com reconhecimento facial, vivacidade, geolocalização e privacidade desde a origem." />
      <FacialClock />
    </div>
  );
}
