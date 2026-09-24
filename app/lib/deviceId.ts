// Anonymous id for this install: map download limits work without an account. Not personal data.
import { randomUUID } from 'expo-crypto';
import { File, Paths } from 'expo-file-system';

let cached: string | null = null;

export function deviceId(): string {
  if (cached) return cached;
  const file = new File(Paths.document, 'device-id');
  cached = file.exists ? file.textSync().trim() : '';
  if (!cached) {
    cached = randomUUID();
    file.create({ overwrite: true });
    file.write(cached);
  }
  return cached;
}
