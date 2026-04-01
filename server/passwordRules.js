export const MIN_PASSWORD_LENGTH = 8;

export function validateStrongPassword(password) {
  const value = String(password || '');

  if (value.length < MIN_PASSWORD_LENGTH) {
    return `La contrasena debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`;
  }

  if (!/[A-Za-z]/.test(value)) {
    return 'La contrasena debe incluir al menos una letra';
  }

  if (!/\d/.test(value)) {
    return 'La contrasena debe incluir al menos un numero';
  }

  if (!/[^A-Za-z0-9]/.test(value)) {
    return 'La contrasena debe incluir al menos un caracter especial';
  }

  return null;
}
