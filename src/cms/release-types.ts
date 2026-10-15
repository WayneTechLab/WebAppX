import type { CmsContent, CmsPublication } from './model'

/** Local snapshots, retained even when a later editorial revision makes a draft release stale. */
export type CmsReleaseMember = CmsContent & {
  entryId: string
  collectionId: string
  authorId: string
  revision: number
  approval: { revision: number; reviewerId: string; receipt: string }
  previousPublication: CmsPublication | null
}
export type CmsReleaseBundle = {
  id: string
  name: string
  status: 'draft' | 'activated'
  createdBy: string
  preparedAtSequence: number
  members: CmsReleaseMember[]
  activatedAtSequence: number | null
  activatedPublications: { entryId: string; publication: CmsPublication }[] | null
}
