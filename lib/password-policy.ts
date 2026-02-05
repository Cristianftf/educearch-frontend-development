export type PasswordPolicyResult = {
  hasMinLength: boolean
  hasUpper: boolean
  hasNumber: boolean
  hasSymbol: boolean
  isValid: boolean
}

export const PASSWORD_MIN_LENGTH = 8

export function evaluatePassword(value: string): PasswordPolicyResult {
  const hasMinLength = value.length >= PASSWORD_MIN_LENGTH
  const hasUpper = /[A-Z]/.test(value)
  const hasNumber = /\d/.test(value)
  const hasSymbol = /[^A-Za-z0-9]/.test(value)

  return {
    hasMinLength,
    hasUpper,
    hasNumber,
    hasSymbol,
    isValid: hasMinLength && hasUpper && hasNumber && hasSymbol,
  }
}

export const PASSWORD_POLICY_HINT =
  "Mínimo 8 caracteres, una mayúscula, un número y un símbolo."
