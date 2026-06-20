// ── Phone & Email validation helpers ──────────────────────────────────────────

export function validatePhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 11) return false
  const ddd = parseInt(digits.slice(0, 2), 10)
  if (ddd < 11 || ddd > 99) return false
  if (digits.length === 11 && digits[2] !== '9') return false
  return true
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function phoneError(raw: string): string | null {
  if (!raw || !raw.replace(/\D/g, '')) return null
  if (!validatePhone(raw)) return 'Telefone inválido. Use formato: (51) 99999-9999'
  return null
}

export function emailError(email: string): string | null {
  if (!email || !email.trim()) return null
  if (!validateEmail(email)) return 'E-mail inválido.'
  return null
}

// ── Focus helper ───────────────────────────────────────────────────────────────
// Foca o primeiro input/select/textarea dentro de um container cujo name/data-field
// corresponde ao fieldName, ou o primeiro elemento com o atributo data-field=fieldName.
// Uso: focusField(containerRef, 'name') ou focusField(containerRef, 'phone')

export function focusField(
  containerRef: React.RefObject<HTMLElement | null>,
  fieldName: string
): void {
  if (!containerRef.current) return
  const sel = `[data-field="${fieldName}"], [name="${fieldName}"]`
  const el = containerRef.current.querySelector<HTMLElement>(sel)
  if (el) {
    el.focus()
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.select()
    }
  }
}

// Foca o primeiro campo inválido dentro de um container.
// Regras:
//   - input/select/textarea com atributo data-required="true" e value vazio
//   - input/select/textarea com atributo data-invalid="true"
// Retorna true se encontrou algum campo inválido.
export function focusFirstInvalid(
  containerRef: React.RefObject<HTMLElement | null>
): boolean {
  if (!containerRef.current) return false
  const candidates = Array.from(
    containerRef.current.querySelectorAll<HTMLElement>(
      'input[data-invalid="true"], select[data-invalid="true"], textarea[data-invalid="true"], ' +
      'input[data-required="true"], select[data-required="true"], textarea[data-required="true"]'
    )
  )
  for (const el of candidates) {
    const isInvalid = el.getAttribute('data-invalid') === 'true'
    const isEmpty   = el.getAttribute('data-required') === 'true' &&
      (el as HTMLInputElement).value.trim() === ''
    if (isInvalid || isEmpty) {
      el.focus()
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.select()
      }
      return true
    }
  }
  return false
}
