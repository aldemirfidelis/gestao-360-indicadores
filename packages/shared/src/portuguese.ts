/** Formata uma quantidade com a concordância indicada para singular e plural. */
export function formatQuantity(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
