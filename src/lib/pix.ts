function crc16(str: string): string {
  let crc = 0xffff
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++)
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0')
}

function emv(id: string, value: string): string {
  return id + String(value.length).padStart(2, '0') + value
}

export function buildPixPayload(
  key: string,
  name: string,
  city: string,
  amount: number
): string {
  const merchant = emv('00', 'BR.GOV.BCB.PIX') + emv('01', key)
  const gui = emv('26', merchant)
  const am = amount > 0 ? emv('54', amount.toFixed(2)) : ''
  const info = emv('62', emv('05', '***'))
  const body =
    '000201' +
    gui +
    '52040000' +
    emv('53', '986') +
    am +
    emv('58', 'BR') +
    emv('59', name.substring(0, 25).toUpperCase()) +
    emv('60', city.substring(0, 15).toUpperCase()) +
    info +
    '6304'
  return body + crc16(body)
}
