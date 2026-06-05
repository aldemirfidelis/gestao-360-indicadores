import { Injectable } from '@nestjs/common';
import { FormTemplateStatus, FormTemplateType } from '@prisma/client';

type Tx = any;

const DEFAULT_TYPES: Array<{
  code: string;
  name: string;
  category: FormTemplateType;
  color: string;
  icon: string;
  purpose: string;
  retentionDays: number;
}> = [
  {
    code: 'FORM',
    name: 'Formulario',
    category: FormTemplateType.FORM,
    color: '#2563eb',
    icon: 'FileText',
    purpose: 'Coleta estruturada de dados corporativos.',
    retentionDays: 1825,
  },
  {
    code: 'CHECKLIST',
    name: 'Checklist',
    category: FormTemplateType.CHECKLIST,
    color: '#16a34a',
    icon: 'ClipboardCheck',
    purpose: 'Verificacao de itens, requisitos e etapas.',
    retentionDays: 1825,
  },
  {
    code: 'OP_RECORD',
    name: 'Registro operacional',
    category: FormTemplateType.OPERATIONAL_RECORD,
    color: '#f59e0b',
    icon: 'NotebookTabs',
    purpose: 'Registro recorrente rastreavel de rotinas operacionais.',
    retentionDays: 3650,
  },
];

const DEFAULT_CATEGORIES = [
  ['Operacoes', '#2563eb'],
  ['Qualidade', '#16a34a'],
  ['Seguranca', '#dc2626'],
  ['Meio ambiente', '#059669'],
  ['Manutencao', '#7c3aed'],
  ['RH', '#db2777'],
] as const;

const DEFAULT_FOLDERS = ['Biblioteca corporativa', 'Operacional', 'Auditorias e compliance', 'Publicos e externos'] as const;
const DEFAULT_TAGS = [
  ['Critico', '#dc2626'],
  ['Recorrente', '#f59e0b'],
  ['Externo', '#2563eb'],
  ['Offline', '#7c3aed'],
] as const;

@Injectable()
export class FormCodeService {
  async ensureDefaults(tx: Tx, companyId: string, userId?: string) {
    const [types, categories, folders, tags] = await Promise.all([
      Promise.all(
        DEFAULT_TYPES.map((item) =>
          tx.formTypeConfig.upsert({
            where: { companyId_code: { companyId, code: item.code } },
            update: { name: item.name, category: item.category, color: item.color, icon: item.icon, purpose: item.purpose, active: true },
            create: {
              companyId,
              code: item.code,
              name: item.name,
              category: item.category,
              color: item.color,
              icon: item.icon,
              purpose: item.purpose,
              retentionDays: item.retentionDays,
              createdById: userId,
            },
          }),
        ),
      ),
      Promise.all(
        DEFAULT_CATEGORIES.map(([name, color]) =>
          tx.formCategory.upsert({
            where: { companyId_name: { companyId, name } },
            update: { color, active: true },
            create: { companyId, name, color },
          }),
        ),
      ),
      Promise.all(
        DEFAULT_FOLDERS.map((name) =>
          tx.formFolder.upsert({
            where: { companyId_name_parentId: { companyId, name, parentId: null } },
            update: { active: true },
            create: { companyId, name, createdById: userId },
          }),
        ),
      ),
      Promise.all(
        DEFAULT_TAGS.map(([name, color]) =>
          tx.formTag.upsert({
            where: { companyId_name: { companyId, name } },
            update: { color },
            create: { companyId, name, color },
          }),
        ),
      ),
    ]);
    return { types, categories, folders, tags };
  }

  async nextTemplateNumber(tx: Tx, companyId: string) {
    const last = await tx.formTemplate.findFirst({ where: { companyId }, orderBy: { number: 'desc' }, select: { number: true } });
    return (last?.number ?? 0) + 1;
  }

  async nextVersionNumber(tx: Tx, templateId: string) {
    const last = await tx.formTemplateVersion.findFirst({ where: { templateId }, orderBy: { versionNumber: 'desc' }, select: { versionNumber: true } });
    return (last?.versionNumber ?? 0) + 1;
  }

  async nextExecutionCode(tx: Tx, companyId: string) {
    const total = await tx.formExecution.count({ where: { companyId } });
    return `FEX-${String(total + 1).padStart(5, '0')}`;
  }

  async nextSubmissionCode(tx: Tx, companyId: string) {
    const total = await tx.formSubmission.count({ where: { companyId } });
    return `FRM-${String(total + 1).padStart(5, '0')}`;
  }

  async nextRecordCode(tx: Tx, companyId: string) {
    const total = await tx.formOperationalRecord.count({ where: { companyId } });
    return `REG-${String(total + 1).padStart(5, '0')}`;
  }

  async nextEvidenceCode(tx: Tx, companyId: string) {
    const total = await tx.formEvidence.count({ where: { companyId } });
    return `FEV-${String(total + 1).padStart(5, '0')}`;
  }

  async nextIssueCode(tx: Tx, companyId: string) {
    const total = await tx.formIssue.count({ where: { companyId } });
    return `FIS-${String(total + 1).padStart(5, '0')}`;
  }

  versionLabel(number: number, explicit?: string | null) {
    const label = String(explicit ?? '').trim();
    return label || `${number}.0`;
  }

  versionStatus(templateStatus: FormTemplateStatus) {
    if (templateStatus === FormTemplateStatus.ACTIVE || templateStatus === FormTemplateStatus.PUBLISHED) return FormTemplateStatus.PUBLISHED;
    if (templateStatus === FormTemplateStatus.APPROVED) return FormTemplateStatus.APPROVED;
    return FormTemplateStatus.DRAFT;
  }
}
