import {
  ProfileEntityTypeSchema,
  UpstreamAppDataSchema,
  UpstreamProfileDataSchema,
} from '@phala/trust-center-db'
import {z} from 'zod'

const entityId = z.number().int().positive().max(2147483647)
const timestamp = z.iso.datetime({offset: true})

export const PhalaCloudPushSchema = z
  .strictObject({
    event_id: z.uuid(),
    sent_at: timestamp,
    profiles: z.array(
      UpstreamProfileDataSchema.extend({
        entity_id: entityId,
        created_at: timestamp,
        updated_at: timestamp.nullable(),
      }),
    ),
    deleted_profiles: z.array(
      z.strictObject({
        entity_type: ProfileEntityTypeSchema,
        entity_id: entityId,
      }),
    ),
    apps: z.array(
      UpstreamAppDataSchema.extend({
        app_id: entityId,
        workspace_id: entityId,
        creator_id: entityId,
        app_created_at: timestamp,
        vm_created_at: timestamp,
      }),
    ),
    deleted_apps: z.array(entityId),
  })
  .superRefine((body, ctx) => {
    const deletedProfiles = new Set(
      body.deleted_profiles.map((p) => `${p.entity_type}:${p.entity_id}`),
    )
    const deletedApps = new Set(body.deleted_apps)
    if (
      body.profiles.some((p) =>
        deletedProfiles.has(`${p.entity_type}:${p.entity_id}`),
      ) ||
      body.apps.some((app) => deletedApps.has(app.app_id))
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'An entity cannot be both upserted and deleted',
      })
    }
  })

export type PhalaCloudPush = z.infer<typeof PhalaCloudPushSchema>
