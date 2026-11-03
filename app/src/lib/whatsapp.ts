// La base guarda el número solo con dígitos y código de país: acá se sacan los espacios, guiones y el "+" que escribe la gente
export function normalizeWhatsapp(typed: string): string {
  return typed.replace(/\D/g, '')
}
