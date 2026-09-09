import type { AppConfigPort } from '@domain/ports/services/AppConfigPort';

export class EnvAppConfig implements AppConfigPort {
  frontendBaseUrl(): string {
    const url =
      process.env.CLIENT_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000';
    return url.replace(/\/$/, '');
  }
}