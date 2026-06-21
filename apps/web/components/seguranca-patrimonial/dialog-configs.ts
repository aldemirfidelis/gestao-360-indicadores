import {
  CUSTODY_STATUS_LABELS,
  CUSTODY_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
  INCIDENT_SEVERITY_LABELS,
  MOVEMENT_TYPE_LABELS,
  PACKAGE_STATUS_LABELS,
  PERSON_TYPE_LABELS,
  RECORD_STATUS_LABELS,
  toOptions,
} from '@/lib/asset-security/labels';
import type { AnyRecord, SecurityOptions } from '@/lib/asset-security/types';
import type { DialogField, EntityDialogState } from './types';

export function buildOptions(data?: SecurityOptions) {
  const map = (rows: AnyRecord[] | undefined, labelKey = 'name') => (rows ?? []).map((row) => ({ value: row.id, label: row[labelKey] ?? row.name ?? row.code ?? row.id }));
  return {
    gates: map(data?.gates),
    posts: map(data?.posts),
    people: map(data?.people),
    vehicles: (data?.vehicles ?? []).map((row) => ({ value: row.id, label: `${row.plate}${row.model ? ` - ${row.model}` : ''}` })),
    contractorCompanies: (data?.contractorCompanies ?? []).map((row) => ({ value: row.id, label: row.tradeName ?? row.legalName })),
    users: map(data?.users),
    orgNodes: map(data?.orgNodes),
    branches: map(data?.branches),
    gateTypes: (data?.gateTypes ?? []).map((value) => ({ value, label: value })),
    vehicleTypes: (data?.vehicleTypes ?? []).map((value) => ({ value, label: value })),
    personTypes: toOptions(data?.personTypes, PERSON_TYPE_LABELS),
    documentStatuses: toOptions(data?.documentStatuses, DOCUMENT_STATUS_LABELS),
    recordStatuses: toOptions(data?.recordStatuses, RECORD_STATUS_LABELS),
    incidentSeverities: toOptions(data?.incidentSeverities, INCIDENT_SEVERITY_LABELS),
    custodyTypes: toOptions(data?.custodyTypes, CUSTODY_TYPE_LABELS),
    custodyStatuses: toOptions(data?.custodyStatuses, CUSTODY_STATUS_LABELS),
    packageStatuses: toOptions(data?.packageStatuses, PACKAGE_STATUS_LABELS),
    movementTypes: toOptions(data?.movementTypes, MOVEMENT_TYPE_LABELS),
  };
}

export type Options = ReturnType<typeof buildOptions>;

export function entryDialog(options: Options): EntityDialogState {
  return { title: 'Registrar entrada', path: '/asset-security/movements/entry', success: 'Entrada registrada', fields: [
    { name: 'gateId', label: 'Portaria', type: 'select', options: options.gates, required: true },
    { name: 'postId', label: 'Posto', type: 'select', options: options.posts },
    { name: 'personId', label: 'Pessoa', type: 'select', options: options.people },
    { name: 'vehicleId', label: 'Veículo', type: 'select', options: options.vehicles },
    { name: 'authorizationId', label: 'Autorização', type: 'text', placeholder: 'ID/código aprovado' },
    { name: 'reason', label: 'Motivo' },
    { name: 'destinationAreaId', label: 'Área de destino', type: 'select', options: options.orgNodes },
    { name: 'expectedExitAt', label: 'Previsão de saída', type: 'datetime' },
    { name: 'exceptionJustification', label: 'Justificativa de exceção', type: 'textarea' },
    { name: 'notes', label: 'Observações', type: 'textarea' },
  ] };
}

export function exitDialog(options: Options): EntityDialogState {
  return { title: 'Registrar saída', path: '/asset-security/movements/exit', success: 'Saída registrada', fields: [
    { name: 'id', label: 'ID da entrada em aberto' },
    { name: 'personId', label: 'Pessoa', type: 'select', options: options.people },
    { name: 'vehicleId', label: 'Veículo', type: 'select', options: options.vehicles },
    { name: 'plate', label: 'Placa' },
    { name: 'code', label: 'Código da movimentação' },
    { name: 'notes', label: 'Observações', type: 'textarea' },
  ] };
}

export function personDialog(options: Options, current?: AnyRecord, defaults?: AnyRecord): EntityDialogState {
  const editing = Boolean(current?.id);
  return {
    title: editing ? 'Editar pessoa' : 'Cadastrar pessoa',
    path: editing ? `/asset-security/people/${current!.id}` : '/asset-security/people',
    method: editing ? 'PATCH' : 'POST',
    success: editing ? 'Pessoa atualizada' : 'Pessoa cadastrada',
    fields: [
      { name: 'name', label: 'Nome', required: true },
      { name: 'type', label: 'Tipo', type: 'select', options: options.personTypes, required: true },
      { name: 'documentType', label: 'Tipo de documento', type: 'select', options: [{ value: 'CPF', label: 'CPF' }, { value: 'CNH', label: 'CNH' }] },
      { name: 'documentNumber', label: 'Documento' },
      { name: 'contractorCompanyId', label: 'Empresa prestadora', type: 'select', options: options.contractorCompanies },
      { name: 'originCompanyName', label: 'Empresa/origem' },
      { name: 'phone', label: 'Telefone' },
      { name: 'email', label: 'E-mail' },
      { name: 'documentStatus', label: 'Situação documental', type: 'select', options: options.documentStatuses },
      { name: 'notes', label: 'Observações', type: 'textarea' },
    ],
    defaults: editing
      ? { name: current!.name, type: current!.type, documentType: current!.documentType, documentNumber: current!.documentNumber, contractorCompanyId: current!.contractorCompanyId, originCompanyName: current!.originCompanyName, phone: current!.phone, email: current!.email, documentStatus: current!.documentStatus, notes: current!.notes }
      : { type: 'VISITOR', documentStatus: 'NOT_REQUIRED', ...defaults },
  };
}

export function vehicleDialog(options: Options, current?: AnyRecord): EntityDialogState {
  const editing = Boolean(current?.id);
  return {
    title: editing ? 'Editar veículo' : 'Cadastrar veículo',
    path: editing ? `/asset-security/vehicles/${current!.id}` : '/asset-security/vehicles',
    method: editing ? 'PATCH' : 'POST',
    success: editing ? 'Veículo atualizado' : 'Veículo cadastrado',
    fields: [
      { name: 'plate', label: 'Placa', required: true },
      { name: 'type', label: 'Tipo', type: 'select', options: options.vehicleTypes, required: true },
      { name: 'model', label: 'Modelo' },
      { name: 'brand', label: 'Marca' },
      { name: 'color', label: 'Cor' },
      { name: 'ownerName', label: 'Proprietário' },
      { name: 'companyName', label: 'Empresa' },
      { name: 'documentStatus', label: 'Situação documental', type: 'select', options: options.documentStatuses },
    ],
    defaults: editing
      ? { plate: current!.plate, type: current!.type, model: current!.model, brand: current!.brand, color: current!.color, ownerName: current!.ownerName, companyName: current!.companyName, documentStatus: current!.documentStatus }
      : { type: 'Carro', documentStatus: 'NOT_REQUIRED' },
  };
}

export function contractorDialog(): EntityDialogState {
  return { title: 'Cadastrar empresa prestadora', path: '/asset-security/contractor-companies', success: 'Empresa cadastrada', fields: [
    { name: 'legalName', label: 'Razão social', required: true },
    { name: 'tradeName', label: 'Nome fantasia' },
    { name: 'cnpj', label: 'CNPJ' },
    { name: 'contractCode', label: 'Contrato' },
    { name: 'serviceTypes', label: 'Serviços (separados por vírgula)' },
    { name: 'documentStatus', label: 'Situação documental', type: 'select', options: toOptions(['VALID', 'EXPIRING', 'EXPIRED', 'MISSING', 'IN_REVIEW', 'REJECTED', 'BLOCKED'], DOCUMENT_STATUS_LABELS) },
    { name: 'notes', label: 'Observações', type: 'textarea' },
  ], defaults: { documentStatus: 'MISSING' } };
}

export function authorizationDialog(options: Options): EntityDialogState {
  return { title: 'Nova autorização', path: '/asset-security/authorizations', success: 'Autorização criada', fields: [
    { name: 'personId', label: 'Pessoa', type: 'select', options: options.people },
    { name: 'vehicleId', label: 'Veículo', type: 'select', options: options.vehicles },
    { name: 'contractorCompanyId', label: 'Empresa prestadora', type: 'select', options: options.contractorCompanies },
    { name: 'gateId', label: 'Portaria', type: 'select', options: options.gates },
    { name: 'destinationAreaId', label: 'Área de destino', type: 'select', options: options.orgNodes },
    { name: 'internalResponsibleId', label: 'Responsável interno', type: 'select', options: options.users },
    { name: 'scheduledStartAt', label: 'Início previsto', type: 'datetime' },
    { name: 'scheduledEndAt', label: 'Fim previsto', type: 'datetime' },
    { name: 'reason', label: 'Motivo', type: 'textarea' },
  ] };
}

export function incidentDialog(options: Options): EntityDialogState {
  return { title: 'Registrar ocorrência', path: '/asset-security/incidents', success: 'Ocorrência registrada', fields: [
    { name: 'title', label: 'Título', required: true },
    { name: 'type', label: 'Tipo' },
    { name: 'severity', label: 'Criticidade', type: 'select', options: options.incidentSeverities, required: true },
    { name: 'gateId', label: 'Portaria', type: 'select', options: options.gates },
    { name: 'postId', label: 'Posto', type: 'select', options: options.posts },
    { name: 'responsibleUserId', label: 'Responsável', type: 'select', options: options.users },
    { name: 'dueAt', label: 'Prazo', type: 'datetime' },
    { name: 'description', label: 'Descrição', type: 'textarea' },
    { name: 'immediateAction', label: 'Ação imediata', type: 'textarea' },
  ], defaults: { severity: 'MEDIUM' } };
}

export function custodyDialog(options: Options): EntityDialogState {
  return { title: 'Cadastrar chave ou crachá', path: '/asset-security/custody-items', success: 'Item cadastrado', fields: [
    { name: 'code', label: 'Código', required: true },
    { name: 'description', label: 'Descrição', required: true },
    { name: 'itemType', label: 'Tipo', type: 'select', options: options.custodyTypes, required: true },
    { name: 'gateId', label: 'Portaria', type: 'select', options: options.gates },
    { name: 'location', label: 'Localização' },
    { name: 'status', label: 'Status', type: 'select', options: options.custodyStatuses },
  ], defaults: { itemType: 'KEY', status: 'AVAILABLE' } };
}

export function loanDialog(id: string, options: Options): EntityDialogState {
  return { title: 'Emprestar item', path: `/asset-security/custody-items/${id}/loan`, success: 'Item emprestado', fields: [
    { name: 'holderPersonId', label: 'Pessoa', type: 'select', options: options.people, required: true },
    { name: 'expectedReturnAt', label: 'Previsão de devolução', type: 'datetime' },
    { name: 'purpose', label: 'Finalidade' },
    { name: 'notes', label: 'Observações', type: 'textarea' },
  ] };
}

export function materialDialog(options: Options): EntityDialogState {
  return { title: 'Movimentar material/carga', path: '/asset-security/materials', success: 'Movimentação registrada', fields: [
    { name: 'description', label: 'Descrição', required: true },
    { name: 'type', label: 'Tipo', type: 'select', options: toOptions(['MATERIAL_ENTRY', 'MATERIAL_EXIT', 'EQUIPMENT_ENTRY', 'EQUIPMENT_EXIT', 'CARGO', 'UNLOADING'], MOVEMENT_TYPE_LABELS) },
    { name: 'quantity', label: 'Quantidade', type: 'number' },
    { name: 'unit', label: 'Unidade' },
    { name: 'vehicleId', label: 'Veículo', type: 'select', options: options.vehicles },
    { name: 'fiscalDocument', label: 'Nota/documento' },
    { name: 'alertCode', label: 'Alerta' },
    { name: 'notes', label: 'Observações', type: 'textarea' },
  ], defaults: { type: 'MATERIAL_ENTRY' } };
}

export function gateDialog(options: Options): EntityDialogState {
  return { title: 'Cadastrar portaria', path: '/asset-security/gates', success: 'Portaria cadastrada', fields: [
    { name: 'name', label: 'Nome', required: true },
    { name: 'code', label: 'Código' },
    { name: 'type', label: 'Tipo', type: 'select', options: options.gateTypes, required: true },
    { name: 'branchId', label: 'Filial', type: 'select', options: options.branches },
    { name: 'unitId', label: 'Unidade', type: 'select', options: options.orgNodes },
    { name: 'address', label: 'Endereço' },
    { name: 'location', label: 'Localização' },
    { name: 'notes', label: 'Observações', type: 'textarea' },
  ], defaults: { type: 'Portaria Principal' } };
}

export function postDialog(options: Options): EntityDialogState {
  return { title: 'Cadastrar posto', path: '/asset-security/posts', success: 'Posto cadastrado', fields: [
    { name: 'name', label: 'Nome', required: true },
    { name: 'code', label: 'Código' },
    { name: 'gateId', label: 'Portaria', type: 'select', options: options.gates },
    { name: 'unitId', label: 'Unidade', type: 'select', options: options.orgNodes },
    { name: 'criticality', label: 'Criticidade', type: 'select', options: toOptions(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) },
    { name: 'responsibleUserId', label: 'Responsável', type: 'select', options: options.users },
    { name: 'location', label: 'Localização' },
    { name: 'instructions', label: 'Instruções', type: 'textarea' },
  ], defaults: { criticality: 'MEDIUM' } };
}

export function packageDialog(options: Options, current?: AnyRecord): EntityDialogState {
  return { title: 'Configurar pacote comercial', path: '/asset-security/package', method: 'PATCH', success: 'Pacote configurado', defaults: { status: current?.status ?? 'ENABLED', enabledFeatures: (current?.enabledFeatures ?? []).join(',') }, fields: [
    { name: 'status', label: 'Status', type: 'select', options: options.packageStatuses },
    { name: 'unitId', label: 'Unidade', type: 'select', options: options.orgNodes },
    { name: 'enabledFeatures', label: 'Recursos ativos (separados por vírgula)', placeholder: 'GATES,VISITORS,QR_CODE,OFFLINE_APP' },
    { name: 'commercialPlanCode', label: 'Plano comercial' },
    { name: 'trialEndsAt', label: 'Fim do teste', type: 'datetime' },
    { name: 'blockReason', label: 'Motivo de bloqueio', type: 'textarea' },
  ] };
}

export function normalizePayload(form: AnyRecord, fields: DialogField[]) {
  const payload: AnyRecord = {};
  for (const field of fields) {
    const value = form[field.name];
    if (field.type === 'checkbox') payload[field.name] = Boolean(value);
    else if (field.type === 'number') payload[field.name] = value === '' || value === undefined ? null : Number(value);
    else if (field.name.endsWith('Ids') || field.name === 'enabledFeatures' || field.name === 'serviceTypes') payload[field.name] = String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
    else payload[field.name] = value === '' || value === undefined ? null : value;
  }
  return payload;
}

