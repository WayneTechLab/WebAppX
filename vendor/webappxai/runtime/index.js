// Create a fresh worker for each signed-in chat session.
export function createPilotWorker() {
  return new Worker('/webappxai/worker.js', { type: 'module', name: 'WebAppXai' })
}
