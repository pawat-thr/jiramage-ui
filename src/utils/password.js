// Shared password policy, used by both the first-time activation form and the
// change-password form so the rules stay identical everywhere.
export const PASSWORD_RULES =
  'At least 8 characters, including 1 uppercase letter, 1 number, and 1 special character.'

// Returns an error message string, or null when the password is valid.
export function validatePassword(pw) {
  if (!pw || pw.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(pw)) return 'Password must include at least 1 uppercase letter.'
  if (!/[0-9]/.test(pw)) return 'Password must include at least 1 number.'
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Password must include at least 1 special character.'
  return null
}
