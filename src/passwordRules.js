export const MIN_PASSWORD_LENGTH = 8;

const PASSWORD_CHECKS = [
  {
    id: 'length',
    label: `Al menos ${MIN_PASSWORD_LENGTH} caracteres`,
    test: (value) => String(value || '').length >= MIN_PASSWORD_LENGTH,
  },
  {
    id: 'letter',
    label: 'Al menos una letra',
    test: (value) => /[A-Za-z]/.test(String(value || '')),
  },
  {
    id: 'number',
    label: 'Al menos un numero',
    test: (value) => /\d/.test(String(value || '')),
  },
  {
    id: 'special',
    label: 'Al menos un caracter especial',
    test: (value) => /[^A-Za-z0-9]/.test(String(value || '')),
  },
];

export const PASSWORD_RULE_HINT = 'Usa al menos 8 caracteres con letras, numeros y un simbolo especial.';

export function evaluatePassword(value) {
  const normalized = String(value || '');
  const checks = PASSWORD_CHECKS.map((check) => ({
    ...check,
    ok: check.test(normalized),
  }));
  const passedChecks = checks.filter((check) => check.ok).length;
  const valid = checks.every((check) => check.ok);

  let level = 0;
  let text = '';

  if (normalized) {
    if (valid) {
      level = 4;
      text = 'Segura';
    } else if (passedChecks >= 3) {
      level = 3;
      text = 'Casi lista';
    } else if (passedChecks >= 2) {
      level = 2;
      text = 'Media';
    } else {
      level = 1;
      text = 'Debil';
    }
  }

  return {
    valid,
    level,
    text,
    checks,
  };
}

export function validatePassword(value) {
  const evaluation = evaluatePassword(value);

  return {
    ...evaluation,
    message: evaluation.valid ? '' : 'La contrasena debe tener al menos 8 caracteres e incluir letras, numeros y un caracter especial.',
  };
}
