/** Taiwan time → ISO. at('2026-10-14 09:30') */
export function at(local: string): string {
  const [date, time = '09:00'] = local.split(' ')
  return new Date(`${date}T${time}:00+08:00`).toISOString()
}
