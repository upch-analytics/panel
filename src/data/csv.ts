// Выгрузка CSV для Excel: BOM, разделитель «;», строки с пометкой о демонстрационных данных

const cell = (v: string | number) => {
  const s = typeof v === 'number' ? String(v).replace('.', ',') : v
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(meta: string[], header: string[], rows: (string | number)[][]): string {
  const lines = [...meta.map(m => cell(m)), '', header.map(cell).join(';'), ...rows.map(r => r.map(cell).join(';'))]
  return '﻿' + lines.join('\r\n')
}

export function downloadCsv(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const stamp = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}
