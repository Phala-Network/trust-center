import {createHash} from 'node:crypto'

// UUID-shaped so it also works as verification_tasks.id. BullMQ forbids ':' in job IDs.
export function verificationTaskId(eventId: string, appId: string): string {
  const hex = createHash('sha256').update(`${eventId}/${appId}`).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}
