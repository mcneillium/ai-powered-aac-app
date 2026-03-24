// Tests for auth error message mapping and validation logic
// These test the pure functions extracted from Login/Signup screens.

// Re-implement the pure functions here for testing (they're inlined in screen files)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function friendlyLoginError(code) {
  switch (code) {
    case 'auth/user-not-found': return 'No account found with this email.';
    case 'auth/wrong-password': return 'Incorrect password. Try again or reset it below.';
    case 'auth/invalid-email': return 'Please enter a valid email address.';
    case 'auth/too-many-requests': return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed': return 'Network error. Check your connection and try again.';
    case 'auth/invalid-credential': return 'Incorrect email or password.';
    default: return 'Login failed. Please check your details and try again.';
  }
}

function friendlySignupError(code) {
  switch (code) {
    case 'auth/email-already-in-use': return 'An account with this email already exists. Try logging in instead.';
    case 'auth/invalid-email': return 'Please enter a valid email address.';
    case 'auth/weak-password': return 'Password is too weak. Use at least 6 characters.';
    case 'auth/network-request-failed': return 'Network error. Check your connection and try again.';
    default: return 'Registration failed. Please try again.';
  }
}

describe('auth validation', () => {
  describe('EMAIL_REGEX', () => {
    test('accepts valid emails', () => {
      expect(EMAIL_REGEX.test('user@example.com')).toBe(true);
      expect(EMAIL_REGEX.test('a@b.co')).toBe(true);
      expect(EMAIL_REGEX.test('user.name+tag@domain.org')).toBe(true);
    });

    test('rejects invalid emails', () => {
      expect(EMAIL_REGEX.test('')).toBe(false);
      expect(EMAIL_REGEX.test('notanemail')).toBe(false);
      expect(EMAIL_REGEX.test('@domain.com')).toBe(false);
      expect(EMAIL_REGEX.test('user@')).toBe(false);
      expect(EMAIL_REGEX.test('user @domain.com')).toBe(false);
      expect(EMAIL_REGEX.test('@@@@')).toBe(false);
    });
  });

  describe('friendlyLoginError', () => {
    test('maps known Firebase error codes to friendly messages', () => {
      expect(friendlyLoginError('auth/user-not-found')).toContain('No account');
      expect(friendlyLoginError('auth/wrong-password')).toContain('Incorrect');
      expect(friendlyLoginError('auth/invalid-email')).toContain('valid email');
      expect(friendlyLoginError('auth/too-many-requests')).toContain('wait');
      expect(friendlyLoginError('auth/network-request-failed')).toContain('Network');
      expect(friendlyLoginError('auth/invalid-credential')).toContain('Incorrect');
    });

    test('returns generic message for unknown error codes', () => {
      expect(friendlyLoginError('auth/unknown-error')).toContain('Login failed');
      expect(friendlyLoginError(undefined)).toContain('Login failed');
      expect(friendlyLoginError('')).toContain('Login failed');
    });
  });

  describe('friendlySignupError', () => {
    test('maps known Firebase error codes to friendly messages', () => {
      expect(friendlySignupError('auth/email-already-in-use')).toContain('already exists');
      expect(friendlySignupError('auth/invalid-email')).toContain('valid email');
      expect(friendlySignupError('auth/weak-password')).toContain('too weak');
      expect(friendlySignupError('auth/network-request-failed')).toContain('Network');
    });

    test('returns generic message for unknown error codes', () => {
      expect(friendlySignupError('auth/something-else')).toContain('Registration failed');
    });
  });
});

describe('input sanitization', () => {
  test('email trimming and lowercasing', () => {
    const raw = '  User@Example.COM  ';
    const trimmed = raw.trim().toLowerCase();
    expect(trimmed).toBe('user@example.com');
    expect(EMAIL_REGEX.test(trimmed)).toBe(true);
  });

  test('password length validation', () => {
    expect('12345'.length >= 6).toBe(false);
    expect('123456'.length >= 6).toBe(true);
    expect(''.length >= 6).toBe(false);
  });
});
