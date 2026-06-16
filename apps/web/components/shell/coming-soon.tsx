import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from './page-header';
import { Sparkles } from 'lucide-react';

interface Props {
  title: string;
  description?: string;
  features: string[];
}

/**
 * Marcador honesto para módulos previstos no escopo da Fase 2.
 * Mostra ao usuário o que esta planejado, em vez de página em branco.
 */
export function ComingSoon({ title, description, features }: Props) {
  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={<Badge variant="secondary">Fase 2</Badge>}
      />
      <Card>
        <CardContent className="p-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Módulo em desenvolvimento</h2>
              <p className="text-sm text-muted-foreground">
                A modelagem de dados já está pronta no backend e este módulo entra na próxima fase do roteiro.
              </p>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Inclui</div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
