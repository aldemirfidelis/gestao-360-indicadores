import type { AnyRecord } from '@/lib/asset-security/types';

export type TabKey = 'overview' | 'operation' | 'people' | 'authorizations' | 'rounds' | 'assets' | 'settings';

export interface DialogField {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'datetime' | 'select' | 'textarea' | 'checkbox';
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  placeholder?: string;
}

export interface EntityDialogState {
  title: string;
  method?: 'POST' | 'PATCH';
  path: string;
  fields: DialogField[];
  defaults?: AnyRecord;
  success: string;
}
