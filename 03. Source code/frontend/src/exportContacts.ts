type Contact = { name: string; email: string; role: string; company: string; source?: string; note?: string }
export type ExportFormat = 'CSV' | 'XLSX' | 'JSON' | 'XML'

const headers = ['Contact', 'Email', 'Chức vụ', 'Doanh nghiệp']
const values = (contact: Contact) => [contact.name, contact.email, contact.role, contact.company]
const xml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
const csv = (value: string) => '"' + (/^[=+\-@\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""') + '"'

export async function createContactExport(format: ExportFormat, contacts: readonly Contact[]): Promise<Blob> {
  const includeSource = contacts.some(c => c.source || c.note)
  const exportHeaders = includeSource ? [...headers, 'Nguồn', 'Ghi chú xác nhận'] : headers
  const exportValues = (c: Contact) => includeSource ? [...values(c), c.source || '', c.note || ''] : values(c)
  if (format === 'XLSX') {
    const { default: writeExcelFile } = await import('write-excel-file/browser')
    return writeExcelFile([exportHeaders, ...contacts.map(exportValues)]).toBlob()
  }
  if (format === 'JSON') return new Blob([JSON.stringify(contacts, null, 2)], { type: 'application/json;charset=utf-8' })
  if (format === 'XML') {
    const rows = contacts.map(contact => `<contact><name>${xml(contact.name)}</name><email>${xml(contact.email)}</email><role>${xml(contact.role)}</role><company>${xml(contact.company)}</company>${includeSource ? `<source>${xml(contact.source || '')}</source><note>${xml(contact.note || '')}</note>` : ''}</contact>`)
    return new Blob([`<?xml version="1.0" encoding="UTF-8"?><contacts>${rows.join('')}</contacts>`], { type: 'application/xml;charset=utf-8' })
  }
  return new Blob(['\uFEFF', [exportHeaders, ...contacts.map(exportValues)].map(row => row.map(csv).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
}
