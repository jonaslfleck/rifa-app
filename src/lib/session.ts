export function saveSession(session: any) {
  localStorage.setItem('session', JSON.stringify(session))
}

export function getSession() {
  const raw = localStorage.getItem('session')
  return raw ? JSON.parse(raw) : null
}

export function logout() {
  localStorage.removeItem('session')
}
