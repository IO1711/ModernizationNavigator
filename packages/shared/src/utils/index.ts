export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

export * from './validation';
