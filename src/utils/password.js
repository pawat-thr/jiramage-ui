// Shared password policy, used by both the first-time activation form and the
// change-password form so the rules stay identical everywhere.
export const PASSWORD_RULES =
  'At least 8 characters, including 1 uppercase letter, 1 number, and 1 special character.'

// The individual rules, exposed so forms can render a live checklist.
export const PASSWORD_CHECKS = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (pw) => !!pw && pw.length >= 8,
    error: 'Password must be at least 8 characters.',
  },
  {
    id: 'upper',
    label: '1 uppercase letter (A–Z)',
    test: (pw) => /[A-Z]/.test(pw || ''),
    error: 'Password must include at least 1 uppercase letter.',
  },
  {
    id: 'number',
    label: '1 number (0–9)',
    test: (pw) => /[0-9]/.test(pw || ''),
    error: 'Password must include at least 1 number.',
  },
  {
    id: 'special',
    label: '1 special character (!@#…)',
    test: (pw) => /[^A-Za-z0-9]/.test(pw || ''),
    error: 'Password must include at least 1 special character.',
  },
]

// Returns an error message string, or null when the password is valid.
export function validatePassword(pw) {
  for (const c of PASSWORD_CHECKS) if (!c.test(pw)) return c.error
  return null
}
