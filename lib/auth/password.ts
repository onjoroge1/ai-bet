export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true
}

export function checkPasswordStrength(password: string): { score: number; feedback: string[]; isValid: boolean } {
  const feedback: string[] = []
  let score = 0

  // Check length
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    feedback.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long`)
  } else {
    score += 1
  }

  // Check uppercase
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    feedback.push('Password must contain at least one uppercase letter')
  } else {
    score += 1
  }

  // Check lowercase
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    feedback.push('Password must contain at least one lowercase letter')
  } else {
    score += 1
  }

  // Check number
  if (PASSWORD_REQUIREMENTS.requireNumber && !/\d/.test(password)) {
    feedback.push('Password must contain at least one number')
  } else {
    score += 1
  }

  // Check special character
  if (PASSWORD_REQUIREMENTS.requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    feedback.push('Password must contain at least one special character')
  } else {
    score += 1
  }

  const isValid = score === 5

  return {
    score,
    feedback,
    isValid
  }
} 