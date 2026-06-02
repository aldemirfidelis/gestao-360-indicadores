// Tipos compartilhados da feature "Administração do Banco de Dados".
// Espelham as respostas do módulo NestJS apps/api/src/modules/database-admin.

export interface DbConnection {
  ok: boolean;
  latencyMs: number;
  engine: string;
  version: string;
}

export interface DbOverview {
  database: { name: string; engine: string; version: string; sizeBytes: number; sizePretty: string };
  connection: DbConnection;
  counts: {
    tables: number;
    views: number;
    indexes: number;
    relationships: number;
    totalEstimatedRows: number;
    migrations: number;
  };
  integrity: { status: string; recentErrors: number };
  lastBackup: { id: string; createdAt: string; type: string; sizeBytes: number } | null;
  biggestTables: TableSummary[];
  recentChanges: DbAdminAuditRow[];
  alerts: { level: 'info' | 'warning' | 'critical'; message: string }[];
}

export interface TableSummary {
  name: string;
  estimatedRows: number;
  columnCount: number;
  indexCount: number;
  foreignKeyCount: number;
  primaryKey: string[];
  sizeBytes: number;
  sizePretty: string;
  comment: string | null;
  kind: 'system' | 'business';
  protected: boolean;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  udtName: string;
  nullable: boolean;
  default: string | null;
  maxLength: number | null;
  position: number;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  references?: { table: string; column: string } | null;
}

export interface ConstraintInfo {
  name: string;
  type: string;
  columns: string[];
  definition: string;
  referencedTable?: string | null;
}

export interface IndexInfo {
  name: string;
  table: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  definition: string;
}

export interface TableSchema {
  table: string;
  columns: ColumnInfo[];
  constraints: ConstraintInfo[];
  indexes: IndexInfo[];
}

export interface RelationshipInfo {
  name: string;
  sourceTable: string;
  sourceColumns: string[];
  targetTable: string;
  targetColumns: string[];
}

export interface DbSchemaGraph {
  tables: TableSummary[];
  relationships: RelationshipInfo[];
}

export interface DiagnosticFinding {
  id: string;
  level: 'info' | 'warning' | 'critical';
  category: string;
  title: string;
  table?: string;
  description: string;
  suggestion?: string;
  recommendedAction?: string;
}

export interface DiagnosticsReport {
  generatedAt: string;
  connection: { ok: boolean; latencyMs: number; version: string };
  schemaVersion: { migrations: number; lastMigration: string | null; appliedAt: string | null };
  summary: { critical: number; warning: number; info: number };
  findings: DiagnosticFinding[];
}

export interface SqlAnalysis {
  statementType: string;
  statementCount: number;
  isReadOnly: boolean;
  hasWhere: boolean;
  risk: 'none' | 'low' | 'medium' | 'high';
  reasons: string[];
  statementTypes: string[];
  allowedInSafeMode: boolean;
  requiresConfirmationPhrase: boolean;
  confirmationPhrase: string;
}

export interface ExecuteResult {
  mode: 'safe' | 'advanced';
  isReadOnly: boolean;
  statementType: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  rowsAffected: number | null;
  truncated: boolean;
  durationMs: number;
  transactionId: string | null;
  analysis: SqlAnalysis;
}

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  isFavorite: boolean;
  createdAt: string;
}

export interface QueryHistoryRow {
  id: string;
  sql: string;
  mode: string;
  durationMs: number | null;
  rowCount: number | null;
  success: boolean;
  message: string | null;
  createdAt: string;
}

export interface DbAdminAuditRow {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userRole: string | null;
  submenu: string;
  action: string;
  mode: string | null;
  targetTable: string | null;
  targetRecordId: string | null;
  sqlText: string | null;
  beforeValue: string | null;
  afterValue: string | null;
  rowsAffected: number | null;
  result: string;
  message: string | null;
  transactionId: string | null;
  backupId: string | null;
  ip: string | null;
  createdAt: string;
}
