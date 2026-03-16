import { ENV } from '../config/env';

describe('ENV config', () => {
  it('exports all required keys', () => {
    const requiredKeys = [
      'FIREBASE_API_KEY',
      'FIREBASE_AUTH_DOMAIN',
      'FIREBASE_DATABASE_URL',
      'FIREBASE_PROJECT_ID',
      'FIREBASE_STORAGE_BUCKET',
      'FIREBASE_MESSAGING_SENDER_ID',
      'FIREBASE_APP_ID',
      'GOOGLE_CLOUD_VISION_API_KEY',
      'HUGGING_FACE_TOKEN',
    ];
    for (const key of requiredKeys) {
      expect(ENV).toHaveProperty(key);
    }
  });

  it('defaults to empty strings when env vars are not set', () => {
    // In test env, process.env won't have these set
    for (const value of Object.values(ENV)) {
      expect(typeof value).toBe('string');
    }
  });
});
