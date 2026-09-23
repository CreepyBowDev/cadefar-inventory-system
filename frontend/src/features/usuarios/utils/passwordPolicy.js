export const PASSWORD_RULES = Object.freeze([
  {
    key: 'length',
    label: 'Entre 8 y 100 caracteres',
    test: (password) => password.length >= 8 && password.length <= 100
  },
  {
    key: 'uppercase',
    label: 'Al menos una letra mayúscula',
    test: (password) => /\p{Lu}/u.test(password)
  },
  {
    key: 'lowercase',
    label: 'Al menos una letra minúscula',
    test: (password) => /\p{Ll}/u.test(password)
  },
  {
    key: 'number',
    label: 'Al menos un número',
    test: (password) => /\p{N}/u.test(password)
  },
  {
    key: 'special',
    label: 'Al menos un carácter especial',
    test: (password) => /[\p{P}\p{S}]/u.test(password)
  }
]);

export const getPasswordValidationError = (password) => {
  const failedRule = PASSWORD_RULES.find((rule) => !rule.test(password));
  return failedRule ? `La contraseña debe incluir: ${failedRule.label.toLowerCase()}.` : '';
};
