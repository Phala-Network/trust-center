import type {AppTask} from './db'

// Helper: Identity function for AppTask (kept for backwards compatibility)
// This function is no longer needed since App type was removed, but kept to avoid breaking changes
export function appToTask(app: AppTask): AppTask {
  return app
}
