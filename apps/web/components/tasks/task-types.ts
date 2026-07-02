export type TaskView = 'kanban' | 'list' | 'calendar' | 'timeline' | 'wiki';

export interface TaskPerson {
  id: string;
  name: string;
  avatarUrl?: string | null;
  jobTitle?: string | null;
}

export interface TaskArea {
  id: string;
  name: string;
  type?: string;
  color?: string | null;
}

export interface TaskProject {
  id: string;
  name: string;
}

export interface TaskColumn {
  id: string;
  boardId: string;
  name: string;
  statusKey: string;
  position: number;
  color: string;
  icon?: string | null;
  isDoneColumn: boolean;
}

export interface TaskBoardData {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  wikiContent?: string | null;
  columns: TaskColumn[];
}

export interface TaskCounts {
  comments: number;
  attachments: number;
  checklistItems: number;
  links: number;
}

export interface TaskRecord {
  id: string;
  companyId: string;
  boardId: string;
  columnId: string;
  title: string;
  description?: string | null;
  status: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dueDate?: string | null;
  startDate?: string | null;
  completedAt?: string | null;
  assigneeId?: string | null;
  createdById?: string | null;
  areaId?: string | null;
  projectId?: string | null;
  position: number;
  color: 'yellow' | 'blue' | 'green' | 'pink' | 'lilac' | 'peach';
  tags: string[];
  isArchived: boolean;
  isAutomatic: boolean;
  sourceType: string;
  sourceModule?: string | null;
  sourceEntityId?: string | null;
  sourceEntityLabel?: string | null;
  sourceUrl?: string | null;
  generatedBy: string;
  generatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  assignee?: TaskPerson | null;
  createdBy?: TaskPerson | null;
  area?: TaskArea | null;
  project?: TaskProject | null;
  _count?: TaskCounts;
  checklistItems?: Array<{ id?: string; title?: string; isDone: boolean; position?: number; assigneeId?: string | null }>;
}

export interface TaskSummary {
  total: number;
  mine: number;
  automatic: number;
  overdue: number;
  executing: number;
  review: number;
  done: number;
  progress: number;
}

export interface TaskBoardResponse {
  board: TaskBoardData;
  tasks: TaskRecord[];
  summary: TaskSummary;
  generatedAt: string;
}

export interface TaskContext {
  users: TaskPerson[];
  areas: TaskArea[];
  projects: TaskProject[];
}

export interface TaskFiltersState {
  scope: 'all' | 'mine' | 'area';
  kind: 'all' | 'manual' | 'automatic';
  priority: string;
  status: string;
  origin: string;
  assigneeId: string;
  areaId: string;
  projectId: string;
  overdue: boolean;
  linked: '' | 'true' | 'false';
  due: '' | 'today' | 'week' | 'none';
}

export interface TaskComment {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  user?: TaskPerson | null;
}

export interface TaskAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType?: string | null;
  createdAt: string;
}

export interface TaskActivity {
  id: string;
  action: string;
  fromValue?: string | null;
  toValue?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  user?: TaskPerson | null;
}

export interface TaskLink {
  id: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  moduleName: string;
  url?: string | null;
}

export interface TaskDetail extends TaskRecord {
  comments: TaskComment[];
  attachments: TaskAttachment[];
  activities: TaskActivity[];
  links: TaskLink[];
  checklistItems: Array<{ id: string; title: string; isDone: boolean; position: number; assigneeId?: string | null }>;
  column: TaskColumn;
  board: { id: string; name: string; columns: TaskColumn[] };
}

export const EMPTY_FILTERS: TaskFiltersState = {
  scope: 'all',
  kind: 'all',
  priority: '',
  status: '',
  origin: '',
  assigneeId: '',
  areaId: '',
  projectId: '',
  overdue: false,
  linked: '',
  due: '',
};
