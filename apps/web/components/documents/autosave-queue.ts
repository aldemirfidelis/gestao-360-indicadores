/** Mantém a última edição e só conclui flush quando todas as gravações terminam. */
export class AutosaveQueue<T> {
  private pending: T | undefined;
  private running: Promise<void> | null = null;

  constructor(private readonly save: (value: T) => Promise<void>) {}

  enqueue(value: T) { this.pending = value; }
  get hasPending() { return this.pending !== undefined; }
  get hasChanges() { return this.hasPending || this.running !== null; }

  async flush(): Promise<void> {
    while (this.hasChanges) {
      if (!this.running && this.pending !== undefined) {
        const value = this.pending;
        this.pending = undefined;
        this.running = Promise.resolve().then(() => this.save(value)).catch((error) => {
          // Uma edição mais recente sempre prevalece sobre a tentativa que falhou.
          if (this.pending === undefined) this.pending = value;
          throw error;
        }).finally(() => { this.running = null; });
      }
      await this.running;
    }
  }
}
