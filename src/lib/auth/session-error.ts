// Não transformar indisponibilidade de Auth/rede em logout.
export function isInvalidSession(error: { status?: number; name?: string; code?: string } | null | undefined) {
  return Boolean(error && (error.status === 401 || error.status === 403 || error.name === 'AuthSessionMissingError'
    || ['refresh_token_not_found', 'refresh_token_already_used', 'session_not_found', 'bad_jwt'].includes(error.code ?? '')));
}
