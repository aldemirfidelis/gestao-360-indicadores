export interface ConditionRule {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'empty' | 'not_empty' | 'in' | 'not_in';
  value?: any;
}

export interface ConditionGroup {
  type: 'AND' | 'OR';
  conditions: (ConditionRule | ConditionGroup)[];
}

export class ExpressionEvaluator {
  static evaluate(expression: ConditionRule | ConditionGroup | null | undefined, context: any): boolean {
    if (!expression) return true;

    if ('type' in expression && 'conditions' in expression) {
      const group = expression as ConditionGroup;
      if (!group.conditions || group.conditions.length === 0) return true;

      if (group.type === 'AND') {
        return group.conditions.every((cond) => this.evaluate(cond, context));
      } else {
        return group.conditions.some((cond) => this.evaluate(cond, context));
      }
    }

    const rule = expression as ConditionRule;
    const fieldValue = this.getNestedValue(context, rule.field);

    switch (rule.operator) {
      case 'eq':
        return String(fieldValue) === String(rule.value);
      case 'neq':
        return String(fieldValue) !== String(rule.value);
      case 'gt':
        return Number(fieldValue) > Number(rule.value);
      case 'gte':
        return Number(fieldValue) >= Number(rule.value);
      case 'lt':
        return Number(fieldValue) < Number(rule.value);
      case 'lte':
        return Number(fieldValue) <= Number(rule.value);
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(rule.value).toLowerCase());
      case 'not_contains':
        return !String(fieldValue).toLowerCase().includes(String(rule.value).toLowerCase());
      case 'starts_with':
        return String(fieldValue).toLowerCase().startsWith(String(rule.value).toLowerCase());
      case 'ends_with':
        return String(fieldValue).toLowerCase().endsWith(String(rule.value).toLowerCase());
      case 'empty':
        return fieldValue === null || fieldValue === undefined || fieldValue === '';
      case 'not_empty':
        return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
      case 'in':
        if (Array.isArray(rule.value)) {
          return rule.value.includes(fieldValue);
        }
        return String(rule.value).split(',').map(s => s.trim()).includes(String(fieldValue));
      case 'not_in':
        if (Array.isArray(rule.value)) {
          return !rule.value.includes(fieldValue);
        }
        return !String(rule.value).split(',').map(s => s.trim()).includes(String(fieldValue));
      default:
        return false;
    }
  }

  private static getNestedValue(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
      if (current === null || current === undefined) return undefined;
      current = current[key];
    }
    return current;
  }
}
