export class FillaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FillaError';
  }
}
