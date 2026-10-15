import { isHrDemoState } from './persistence'
import { recruitingHireAdapter } from './recruiting-hire'
import { recruitingInterviewHandler } from './recruiting-interviews'
import { recruitingRequisitions } from './recruiting-requisitions'
import type { RecruitingCoreServices } from './recruiting-lifecycle-types'
import { supportsRecruitingTimeZone } from './recruiting-time-zone'

/** Trusted composition only. Scoped components receive the controller ports. */
export const recruitingCoreServices: RecruitingCoreServices = {
  requisitions: recruitingRequisitions,
  interviews: recruitingInterviewHandler,
  hire: recruitingHireAdapter,
  validateCandidate: isHrDemoState,
  isTimeZoneSupported: supportsRecruitingTimeZone,
}
