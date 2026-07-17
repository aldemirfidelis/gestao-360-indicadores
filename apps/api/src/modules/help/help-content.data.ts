import { HelpCatalogCategory } from './content/types';
import { primeirosPassos } from './content/primeiros-passos';
import { meuDia } from './content/meu-dia';
import { gestaoAVista } from './content/gestao-a-vista';
import { qualidadeCompliance } from './content/qualidade-compliance';
import { segurancaAlimentos } from './content/seguranca-alimentos';
import { segurancaPatrimonial } from './content/seguranca-patrimonial';
import { cargosSalarios } from './content/cargos-salarios';
import { servicoPessoal } from './content/servico-pessoal';
import { comunicacao } from './content/comunicacao';
import { gestaoPremio } from './content/gestao-premio';
import { administracao } from './content/administracao';
import { guiasPreenchimento } from './content/guias-preenchimento';

export type { HelpCatalogCategory } from './content/types';

/**
 * Catálogo oficial da Central de Ajuda (base de conhecimento do Assistente G360).
 * É sincronizado com o banco no boot da API (HelpService.syncCatalog):
 * - categorias e artigos são upsertados por slug;
 * - artigos com slug do catálogo são gerenciados por código (edições manuais
 *   via admin são sobrescritas no próximo boot);
 * - artigos/categorias criados pelo admin com outros slugs nunca são tocados.
 */
export const HELP_CATALOG: HelpCatalogCategory[] = [
  primeirosPassos,
  meuDia,
  gestaoAVista,
  qualidadeCompliance,
  segurancaAlimentos,
  segurancaPatrimonial,
  cargosSalarios,
  servicoPessoal,
  comunicacao,
  gestaoPremio,
  administracao,
  guiasPreenchimento,
];
