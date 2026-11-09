export const AUTH_REDIRECT_PATH = '/panel'

export function authRedirectUrl(origin: string) {
  return `${origin.replace(/\/$/, '')}${AUTH_REDIRECT_PATH}`
}
