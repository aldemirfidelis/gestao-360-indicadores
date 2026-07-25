import { PageHeader } from '@/components/shell/page-header';
import { EmployeeBiometricEnrollment } from '@/components/personnel/employee-biometric-enrollment';

export default function EmployeeBiometricsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Cadastros Faciais"
        description="Cadastre e gerencie a biometria dos colaboradores por matrícula para reconhecimento em todos os totens autorizados."
      />
      <EmployeeBiometricEnrollment />
    </div>
  );
}
