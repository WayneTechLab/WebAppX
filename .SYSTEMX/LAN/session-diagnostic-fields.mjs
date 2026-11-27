const components = ['app', 'lan', 'auth', 'firestore', 'storage']
const roles = ['session', 'vite', 'firebase', 'lan']
const probeOutcomes = ['starting', 'ready', 'failed', 'unverified']

// Both the export format and its maximum size follow these fixed field tables.
// Free-form messages, commands, environment, file paths and app data are never copied.
export function diagnosticFields(record = {}, plan = { processes: [] }) {
  const ports = {}, readiness = {}
  for (const name of components) {
    const value = ['app', 'lan'].includes(name) ? record.ports?.[name] : record.ports?.firebase?.[name]
    ports[name] = Number.isInteger(value) && value >= 1024 && value <= 65535 ? value : null
    const status = record.readiness?.[name]?.status
    readiness[name] = probeOutcomes.includes(status) ? status : 'unverified'
  }
  const processes = []
  for (const role of roles) {
    const entry = plan.processes.find(item => item.role === role)
    if (!entry) continue
    const ownership = entry.state === 'owned' && entry.identity === 'recorded-start-parent-and-command-match'
      ? 'owned' : entry.state === 'exited' ? 'exited' : 'unverified'
    processes.push({ role, pid: Number.isInteger(entry.pid) && entry.pid > 0 && entry.pid <= 0x7fffffff ? entry.pid : null, ownership })
  }
  return { processes, ports, readiness }
}
