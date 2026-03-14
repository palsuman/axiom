const TAG = '[desktop-shell]';

export function log(...args: unknown[]) {
  console.log(TAG, ...args);
}

export function logError(message: string, error: unknown) {
  console.error(TAG, message, error);
}
