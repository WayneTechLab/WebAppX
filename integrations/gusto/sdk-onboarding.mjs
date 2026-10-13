// In-memory, synthetic administrative onboarding contract for Embedded React SDK 0.56.6.
// No network calls, credentials, legal submissions, or persistent personal records.
const LOCATION_ID = '00000000-0000-4000-8000-000000000011'
const copy = value => structuredClone(value)
const own = (map, key) => Object.hasOwn(map, key) ? map[key] : undefined
const rows = (map, employeeId) => Object.values(map).filter(row => row.employee_uuid === employeeId)
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 160
const money = value => (typeof value === 'string' && /^\d{1,8}(\.\d{1,2})?$/.test(value)) ||
  (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 99_999_999 && Math.round(value * 100) / 100 === value)
const formatMoney = value => Number(value).toFixed(2)
const version = row => `mock-v${Number(row.version?.match(/v(\d+)$/)?.[1] ?? 0) + 1}`
const newMap = () => Object.create(null)

class InvalidMockInput extends Error {}
const requireInput = (condition, message) => { if (!condition) throw new InvalidMockInput(message) }
const shape = (body, allowed) => {
  requireInput(body && typeof body === 'object' && !Array.isArray(body), 'A JSON object is required.')
  requireInput(Object.keys(body).every(key => allowed.includes(key)), 'Unsupported fields are not accepted by this synthetic endpoint.')
}
const syntheticEmail = value => value == null || (typeof value === 'string' && /^[^\s@]+@[^\s@]+\.invalid$/.test(value) && value.length <= 180)

/** Seed per-session state. Avery/Morgan retain their fixture lifecycle; Jordan starts incomplete. */
export function createOnboardingState(employees, companyId) {
  const state = {
    jobs: newMap(), compensations: newMap(), homeAddresses: newMap(), workAddresses: newMap(),
    federalTaxes: newMap(), stateTaxes: newMap(), paymentMethods: newMap(), bankAccounts: newMap(),
    garnishments: newMap(), locations: newMap(), onboardingSaved: newMap(), nextOnboardingId: 4000,
  }
  state.locations[LOCATION_ID] = {
    uuid: LOCATION_ID, version: 'mock-v1', company_uuid: companyId, country: 'USA',
    street_1: '100 Fictional Lane', street_2: null, city: 'Austin', state: 'TX', zip: '78701',
    active: true, mailing_address: true, filing_address: true,
  }
  for (const employee of employees) {
    employee.version ??= 'mock-v1'
    employee.date_of_birth ??= '1992-02-12'
    employee.has_ssn = true // Synthetic, already masked fixture; no raw identifier is stored.
    employee.ssn = ''
    employee.hidden_ssn = '***-**-6789'
    employee.onboarding_documents_config = { uuid: null, i9_document: false }
    employee.eligible_paid_time_off ??= []
    employee.garnishments ??= []
    const complete = employee.onboarded === true
    state.onboardingSaved[employee.uuid] = { profile: complete, federal: complete, state: complete, payment: complete,
      compensations: newMap(), formsReviewed: complete, newHireReportReviewed: complete }
    state.federalTaxes[employee.uuid] = federalDefault(employee.uuid)
    state.stateTaxes[employee.uuid] = []
    state.paymentMethods[employee.uuid] = { version: 'mock-v1', type: 'Check', split_by: null, splits: null }
    for (const seed of employee.jobs ?? []) {
      const job = { ...seed, employee_uuid: employee.uuid, version: 'mock-v1',
        location_uuid: LOCATION_ID, location: copy(state.locations[LOCATION_ID]), compensations: [] }
      state.jobs[job.uuid] = job
      const suppliedCompensation = seed.compensations?.find(comp => comp.uuid === seed.current_compensation_uuid) ?? seed.compensations?.[0]
      const compensationId = suppliedCompensation?.uuid ?? `00000000-0000-4000-8000-${String(600 + Object.keys(state.compensations).length).padStart(12, '0')}`
      const compensation = { uuid: compensationId, version: 'mock-v1', job_uuid: job.uuid, employee_uuid: employee.uuid,
        rate: '30.00', payment_unit: 'Hour', flsa_status: 'Nonexempt', effective_date: job.hire_date,
        adjust_for_minimum_wage: false, minimum_wages: [], ...copy(suppliedCompensation ?? {}),
        uuid: compensationId, job_uuid: job.uuid, employee_uuid: employee.uuid,
        title: suppliedCompensation?.title ?? job.title }
      state.compensations[compensationId] = compensation
      state.onboardingSaved[employee.uuid].compensations[compensationId] = complete
      job.current_compensation_uuid = compensationId
      job.rate = compensation.rate
      job.payment_unit = compensation.payment_unit
      job.compensations = [compensation]
    }
    employee.jobs = rows(state.jobs, employee.uuid)
    if (complete) {
      const suffix = employee.uuid.slice(-3)
      const homeId = `00000000-0000-4000-8000-000000007${suffix}`
      const workId = `00000000-0000-4000-8000-000000008${suffix}`
      state.homeAddresses[homeId] = { uuid: homeId, version: 'mock-v1', employee_uuid: employee.uuid,
        street_1: '100 Fictional Lane', street_2: null, city: 'Austin', state: 'TX', zip: '78701',
        country: 'USA', active: true, effective_date: '2026-01-05', courtesy_withholding: false }
      state.workAddresses[workId] = { ...copy(state.locations[LOCATION_ID]), uuid: workId,
        employee_uuid: employee.uuid, location_uuid: LOCATION_ID, effective_date: '2026-01-05' }
    }
  }
  return state
}

function federalDefault(employeeId) {
  return { version: 'mock-v1', employee_uuid: employeeId, w4_data_type: 'rev_2020_w4',
    filing_status: 'Single', extra_withholding: '0.00', two_jobs: false,
    dependents_amount: '0.00', other_income: '0.00', deductions: '0.00' }
}

function validateProfile(body, create = false) {
  shape(body, ['version', 'first_name', 'middle_initial', 'last_name', 'email', 'work_email',
    'date_of_birth', 'ssn', 'preferred_first_name', 'self_onboarding', 'two_percent_shareholder'])
  for (const field of ['first_name', 'last_name']) {
    if (create || field in body) requireInput(text(body[field]), `${field} is required and bounded.`)
  }
  for (const field of ['email', 'work_email']) {
    if (field in body) requireInput(syntheticEmail(body[field]), 'Only synthetic email addresses ending in .invalid are accepted.')
  }
  if ('date_of_birth' in body) requireInput(date(body.date_of_birth) && body.date_of_birth <= '2008-10-13', 'Use a valid synthetic adult date of birth.')
  if ('ssn' in body) requireInput(body.ssn === '123456789', 'Only the fixed synthetic identifier 123456789 is accepted; personal identifiers are refused.')
  if ('middle_initial' in body) requireInput(body.middle_initial === null || (typeof body.middle_initial === 'string' && body.middle_initial.length <= 1), 'middle_initial must contain at most one character.')
  if ('preferred_first_name' in body) requireInput(body.preferred_first_name == null || body.preferred_first_name === '' || text(body.preferred_first_name), 'Use a bounded preferred name.')
  if ('self_onboarding' in body) requireInput(body.self_onboarding === false, 'This mock supports administrative onboarding only.')
  if ('two_percent_shareholder' in body) requireInput(typeof body.two_percent_shareholder === 'boolean', 'two_percent_shareholder must be boolean.')
}

function saveProfile(employee, body) {
  const { version: ignoredVersion, ssn, self_onboarding: ignoredSelf, ...profile } = body
  Object.assign(employee, profile)
  if (ssn === '123456789') Object.assign(employee, { has_ssn: true, ssn: '', hidden_ssn: '***-**-6789' })
  employee.version = version(employee)
}

function stepsFor(employee, state) {
  const saved = state.onboardingSaved[employee.uuid]
  const home = rows(state.homeAddresses, employee.uuid).some(row => row.active)
  const work = rows(state.workAddresses, employee.uuid).some(row => row.active)
  const compensation = rows(state.jobs, employee.uuid).some(job => job.hire_date && job.compensations?.some(row =>
    Number(row.rate) > 0 && own(saved.compensations, row.uuid) === true))
  const steps = [
    ['personal_details', 'Personal details', Boolean(saved?.profile && employee.first_name && employee.last_name && employee.date_of_birth && employee.has_ssn), true, []],
    ['add_home_address', 'Home address', home, true, ['personal_details']],
    ['add_work_address', 'Work address', work, true, ['personal_details']],
    ['compensation_details', 'Job and compensation', compensation, true, ['add_work_address']],
    ['federal_tax_setup', 'Federal tax details', Boolean(saved?.federal), true, ['personal_details']],
    ['state_tax_setup', 'State tax details', state.stateTaxes[employee.uuid].length === 0 || Boolean(saved?.state), true, ['add_home_address', 'add_work_address']],
    ['direct_deposit_setup', 'Payment method', Boolean(saved?.payment), true, ['personal_details']],
    ['employee_form_signing', 'Synthetic document review (no legal signature)', Boolean(saved?.formsReviewed), true, ['personal_details', 'federal_tax_setup']],
    ['file_new_hire_report', 'Synthetic new hire report review (no filing)', Boolean(saved?.newHireReportReviewed), true, ['add_home_address', 'add_work_address']],
  ]
  return { uuid: employee.uuid, onboarding_status: employee.onboarding_status, blockers: [],
    onboarding_steps: steps.map(([id, title, completed, required, requirements]) => ({ id, title, completed, required, requirements })) }
}

const addressFields = ['version', 'street_1', 'street_2', 'city', 'state', 'zip', 'country', 'effective_date', 'courtesy_withholding']
function validateAddress(body, existing = {}) {
  shape(body, addressFields)
  const combined = { ...existing, ...body }
  for (const field of ['street_1', 'city']) requireInput(text(combined[field]), `${field} is required.`)
  if ('street_2' in combined) requireInput(combined.street_2 == null || combined.street_2 === '' || text(combined.street_2), 'street_2 is too long.')
  requireInput(combined.state === 'TX', 'The tested synthetic onboarding fixture supports Texas addresses only.')
  requireInput(typeof combined.zip === 'string' && /^\d{5}(-\d{4})?$/.test(combined.zip), 'Use a five digit synthetic ZIP.')
  requireInput(combined.country === undefined || combined.country === 'USA', 'The tested fixture supports USA only.')
  if (combined.effective_date != null) requireInput(date(combined.effective_date), 'effective_date must be a valid calendar date.')
  if ('courtesy_withholding' in combined) requireInput(typeof combined.courtesy_withholding === 'boolean', 'courtesy_withholding must be boolean.')
}

function validateJob(body, existing = {}) {
  shape(body, ['version', 'title', 'hire_date', 'two_percent_shareholder', 'state_wc_covered', 'state_wc_class_code'])
  const combined = { ...existing, ...body }
  requireInput(text(combined.title), 'A bounded synthetic job title is required.')
  requireInput(date(combined.hire_date), 'A valid hire date is required.')
  for (const field of ['two_percent_shareholder', 'state_wc_covered']) {
    if (body[field] != null) requireInput(typeof body[field] === 'boolean', `${field} must be boolean.`)
  }
  if (body.state_wc_class_code != null) requireInput(text(body.state_wc_class_code), 'Use a bounded class code.')
}

function validateCompensation(body, existing = {}) {
  shape(body, ['version', 'rate', 'payment_unit', 'flsa_status', 'effective_date', 'title', 'adjust_for_minimum_wage', 'minimum_wages'])
  const combined = { ...existing, ...body }
  requireInput(money(combined.rate) && Number(combined.rate) > 0, 'Use a positive bounded synthetic pay rate.')
  requireInput(['Hour', 'Week', 'Month', 'Year', 'Paycheck'].includes(combined.payment_unit), 'Unsupported payment unit.')
  requireInput(['Exempt', 'Salaried Nonexempt', 'Nonexempt', 'Owner', 'Commission Only Exempt', 'Commission Only Nonexempt'].includes(combined.flsa_status), 'Unsupported FLSA status.')
  if (combined.effective_date != null) requireInput(date(combined.effective_date), 'Use a valid compensation date.')
  if ('adjust_for_minimum_wage' in body) requireInput(typeof body.adjust_for_minimum_wage === 'boolean', 'adjust_for_minimum_wage must be boolean.')
  if ('minimum_wages' in body) requireInput(Array.isArray(body.minimum_wages) && body.minimum_wages.length === 0, 'No wage calculations are implemented by this fixture.')
}

/** Return null for endpoints owned by the caller's directory, session or payroll adapter. */
export function handleOnboarding({ method = 'GET', path, query, body, state, respond, error, allocateId }) {
  const answer = (status, value) => respond(status, copy(value))
  const notFound = () => error(404, 'mock_resource_not_found', 'The requested resource is not owned by this synthetic company.')
  const methodDenied = () => error(405, 'mock_method_not_supported', 'This method is not supported by the synthetic endpoint.')
  const conflict = () => error(409, 'mock_version_conflict', 'The object version changed; read the current object before saving.')
  const employeeFor = id => state.employees.find(employee => employee.uuid === id && employee.company_uuid === state.companyId)
  const editable = employee => employee && !employee.terminated
  const checkVersion = row => typeof body?.version === 'string' && body.version === row.version
  const id = kind => (allocateId ?? state.allocateId)?.(kind) ?? `00000000-0000-4000-8000-${String(++state.nextOnboardingId).padStart(12, '0')}`
  const syncEmployeeJobs = employee => { employee.jobs = rows(state.jobs, employee.uuid) }
  const dataSteps = employee => stepsFor(employee, state).onboarding_steps.filter(step =>
    !['employee_form_signing', 'file_new_hire_report'].includes(step.id))
  const changed = employee => {
    const saved = state.onboardingSaved[employee.uuid]
    saved.formsReviewed = false
    saved.newHireReportReviewed = false
    employee.onboarding_status = 'admin_onboarding_incomplete'
    employee.onboarded = false
  }
  const updateJobCompensations = job => {
    job.compensations = Object.values(state.compensations).filter(comp => comp.job_uuid === job.uuid)
    const current = own(state.compensations, job.current_compensation_uuid)
    if (current) Object.assign(job, { rate: current.rate, payment_unit: current.payment_unit })
    syncEmployeeJobs(employeeFor(job.employee_uuid))
  }
  try {
    let match
    if (path === '/__onboarding_review') {
      const employeeId = method === 'GET' ? (query instanceof URLSearchParams ? query.get('employeeId') : query?.employeeId) : body?.employeeId
      const employee = employeeFor(employeeId)
      if (!employee) return notFound()
      const dataStepsComplete = dataSteps(employee).every(step => !step.required || step.completed)
      if (method === 'GET') return answer(200, { dataStepsComplete })
      if (method !== 'POST') return methodDenied()
      if (!editable(employee)) return error(409, 'mock_employee_inactive', 'Terminated fixture employees cannot be changed.')
      shape(body, ['employeeId', 'formsReviewed', 'newHireReportReviewed'])
      requireInput(dataStepsComplete, 'Save all required synthetic data steps before reviewing mock documents and filing.')
      requireInput(body.formsReviewed === true && body.newHireReportReviewed === true, 'Explicitly review both synthetic documents and the synthetic new hire report.')
      const saved = state.onboardingSaved[employee.uuid]
      saved.formsReviewed = true
      saved.newHireReportReviewed = true
      return answer(200, { employeeId: employee.uuid, dataStepsComplete: true, formsReviewed: true, newHireReportReviewed: true,
        legalSignatureCreated: false, reportFiled: false })
    }
    if ((match = /^\/v1\/companies\/([^/]+)\/(locations|federal_tax_details|employees)$/.exec(path))) {
      if (match[1] !== state.companyId) return notFound()
      if (match[2] === 'locations') return method === 'GET' ? answer(200, Object.values(state.locations)) : methodDenied()
      if (match[2] === 'federal_tax_details') return method === 'GET' ? answer(200, {
        version: 'mock-v1', tax_payer_type: 'C-Corporation', taxable_as_scorp: false, filing_form: '941',
        has_ein: true, ein_verified: false, legal_name: 'Fictional Demo Employer',
      }) : methodDenied()
      if (method !== 'POST') return null // Employee directory GET belongs to the caller.
      validateProfile(body, true)
      requireInput(state.employees.length < 50, 'The synthetic session is limited to 50 employees.')
      const employee = { uuid: id('employee'), company_uuid: state.companyId, version: 'mock-v0',
        first_name: '', last_name: '', email: null, payment_method: 'Check', terminated: false,
        onboarded: false, onboarding_status: 'admin_onboarding_incomplete', date_of_birth: null,
        has_ssn: false, ssn: '', jobs: [], terminations: [], garnishments: [], eligible_paid_time_off: [],
        onboarding_documents_config: { uuid: null, i9_document: false } }
      saveProfile(employee, body)
      state.employees.push(employee)
      state.onboardingSaved[employee.uuid] = { profile: Boolean(employee.date_of_birth && employee.has_ssn), federal: false, state: false, payment: false,
        compensations: newMap(), formsReviewed: false, newHireReportReviewed: false }
      state.federalTaxes[employee.uuid] = federalDefault(employee.uuid)
      state.stateTaxes[employee.uuid] = []
      state.paymentMethods[employee.uuid] = { version: 'mock-v1', type: 'Check', split_by: null, splits: null }
      return answer(201, employee)
    }
    if ((match = /^\/v1\/locations\/([^/]+)\/minimum_wages$/.exec(path))) {
      return own(state.locations, match[1])?.company_uuid === state.companyId ? (method === 'GET' ? answer(200, []) : methodDenied()) : notFound()
    }
    if ((match = /^\/v1\/employees\/([^/]+)(?:\/(onboarding_status|home_addresses|work_addresses|jobs|federal_taxes|state_taxes|payment_method|bank_accounts|garnishments|onboarding_documents_config)(?:\/([^/]+))?)?$/.exec(path))) {
      const employee = employeeFor(match[1])
      if (!employee) return notFound()
      const resource = match[2]
      if (match[3] && resource !== 'bank_accounts') return notFound()
      if (method !== 'GET' && !editable(employee)) return error(409, 'mock_employee_inactive', 'Terminated fixture employees cannot be changed.')
      if (!resource) {
        if (method === 'GET') { syncEmployeeJobs(employee); return answer(200, employee) }
        if (method === 'PUT') {
          validateProfile(body)
          if (!checkVersion(employee)) return conflict()
          saveProfile(employee, body)
          changed(employee)
          state.onboardingSaved[employee.uuid].profile = Boolean(employee.first_name && employee.last_name && employee.date_of_birth && employee.has_ssn)
          return answer(200, employee)
        }
        if (method === 'DELETE') {
          if (employee.onboarded) return error(409, 'mock_delete_blocked', 'Only incomplete synthetic onboarding records may be removed.')
          state.employees.splice(state.employees.indexOf(employee), 1)
          for (const mapName of ['jobs', 'compensations', 'homeAddresses', 'workAddresses', 'bankAccounts', 'garnishments']) {
            for (const row of rows(state[mapName], employee.uuid)) delete state[mapName][row.uuid]
          }
          for (const mapName of ['federalTaxes', 'stateTaxes', 'paymentMethods', 'onboardingSaved']) delete state[mapName][employee.uuid]
          return answer(204, null)
        }
        return methodDenied()
      }
      if (resource === 'onboarding_status') {
        const status = stepsFor(employee, state)
        if (method === 'GET') return answer(200, status)
        if (method !== 'PUT') return methodDenied()
        shape(body, ['onboarding_status'])
        requireInput(['admin_onboarding_incomplete', 'onboarding_completed'].includes(body.onboarding_status), 'Only the administrative synthetic statuses are supported.')
        if (body.onboarding_status === 'onboarding_completed' && status.onboarding_steps.some(step => step.required && !step.completed)) {
          return error(422, 'mock_onboarding_incomplete', 'Save all required synthetic onboarding steps before completing this workflow.')
        }
        employee.onboarding_status = body.onboarding_status
        employee.onboarded = body.onboarding_status === 'onboarding_completed'
        employee.version = version(employee)
        return answer(200, { ...stepsFor(employee, state), mock_completion: {
          synthetic: true, legal_signature_created: false, report_filed: false,
        } })
      }
      if (resource === 'onboarding_documents_config') {
        if (method !== 'PUT') return methodDenied()
        shape(body, ['i9_document'])
        requireInput(body.i9_document === false, 'The mock does not implement legally effective document or I-9 signing.')
        employee.onboarding_documents_config = { uuid: null, i9_document: false }
        return answer(200, employee)
      }
      if (resource === 'home_addresses') {
        if (method === 'GET') return answer(200, rows(state.homeAddresses, employee.uuid))
        if (method !== 'POST') return methodDenied()
        validateAddress(body)
        requireInput(rows(state.homeAddresses, employee.uuid).length < 10, 'The session is limited to ten home addresses per employee.')
        const row = { ...body, uuid: id('homeAddress'), version: 'mock-v1', employee_uuid: employee.uuid,
          active: true, country: 'USA', effective_date: body.effective_date ?? '2026-10-13', courtesy_withholding: body.courtesy_withholding ?? false }
        for (const old of rows(state.homeAddresses, employee.uuid)) old.active = false
        state.homeAddresses[row.uuid] = row
        changed(employee)
        return answer(201, row)
      }
      if (resource === 'work_addresses') {
        if (method === 'GET') return answer(200, rows(state.workAddresses, employee.uuid))
        if (method !== 'POST') return methodDenied()
        shape(body, ['location_uuid', 'effective_date'])
        const location = own(state.locations, body.location_uuid)
        requireInput(location?.company_uuid === state.companyId, 'Select this synthetic company\'s location.')
        if ('effective_date' in body) requireInput(date(body.effective_date), 'Use a valid work address start date when supplied.')
        requireInput(rows(state.workAddresses, employee.uuid).length < 10, 'The session is limited to ten work addresses per employee.')
        const row = { ...copy(location), uuid: id('workAddress'), version: 'mock-v1', employee_uuid: employee.uuid,
          location_uuid: location.uuid, ...(body.effective_date === undefined ? {} : { effective_date: body.effective_date }), active: true }
        for (const old of rows(state.workAddresses, employee.uuid)) old.active = false
        state.workAddresses[row.uuid] = row
        changed(employee)
        return answer(201, row)
      }
      if (resource === 'jobs') {
        if (method === 'GET') return answer(200, rows(state.jobs, employee.uuid))
        if (method !== 'POST') return methodDenied()
        validateJob(body)
        requireInput(rows(state.jobs, employee.uuid).length < 10, 'The session is limited to ten jobs per employee.')
        const job = { ...body, uuid: id('job'), version: 'mock-v1', employee_uuid: employee.uuid,
          primary: rows(state.jobs, employee.uuid).length === 0, location_uuid: LOCATION_ID,
          location: copy(state.locations[LOCATION_ID]), compensations: [], rate: '0.00', payment_unit: 'Hour' }
        const compensation = { uuid: id('compensation'), version: 'mock-v1', employee_uuid: employee.uuid,
          job_uuid: job.uuid, title: job.title, rate: '0.00', payment_unit: 'Hour', flsa_status: 'Nonexempt',
          effective_date: body.hire_date, adjust_for_minimum_wage: false, minimum_wages: [] }
        state.compensations[compensation.uuid] = compensation
        job.current_compensation_uuid = compensation.uuid
        state.jobs[job.uuid] = job
        changed(employee)
        updateJobCompensations(job)
        return answer(201, job)
      }
      if (resource === 'federal_taxes') {
        const row = state.federalTaxes[employee.uuid]
        if (method === 'GET') return answer(200, row)
        if (method !== 'PUT') return methodDenied()
        shape(body, ['version', 'w4_data_type', 'filing_status', 'two_jobs', 'dependents_amount', 'other_income', 'deductions', 'extra_withholding'])
        if (!checkVersion(row)) return conflict()
        requireInput(body.w4_data_type === 'rev_2020_w4' && ['Single', 'Married', 'Head of Household', 'Exempt from withholding'].includes(body.filing_status), 'Use a supported synthetic W-4 selection.')
        if ('two_jobs' in body) requireInput(typeof body.two_jobs === 'boolean', 'two_jobs must be boolean.')
        for (const field of ['dependents_amount', 'other_income', 'deductions', 'extra_withholding']) {
          if (field in body) requireInput(money(body[field]), 'Use bounded nonnegative synthetic withholding amounts.')
        }
        row.w4_data_type = body.w4_data_type
        row.filing_status = body.filing_status
        row.two_jobs = body.two_jobs ?? row.two_jobs
        for (const field of ['dependents_amount', 'other_income', 'deductions', 'extra_withholding']) if (field in body) row[field] = formatMoney(body[field])
        row.version = version(row)
        state.onboardingSaved[employee.uuid].federal = true
        changed(employee)
        return answer(200, row)
      }
      if (resource === 'state_taxes') {
        if (method === 'GET') return answer(200, state.stateTaxes[employee.uuid])
        if (method !== 'PUT') return methodDenied()
        shape(body, ['states'])
        requireInput(Array.isArray(body.states) && body.states.length === 0, 'The Texas fixture has no state withholding questions; other states are outside this tested mock.')
        state.onboardingSaved[employee.uuid].state = true
        changed(employee)
        return answer(200, [])
      }
      if (resource === 'payment_method') {
        const row = state.paymentMethods[employee.uuid]
        if (method === 'GET') return answer(200, row)
        if (method !== 'PUT') return methodDenied()
        shape(body, ['version', 'type', 'split_by', 'splits'])
        if (!checkVersion(row)) return conflict()
        requireInput(['Check', 'Direct Deposit'].includes(body.type), 'Select Check or a synthetic direct deposit split.')
        let splits = null
        if (body.type === 'Direct Deposit') {
          requireInput(['Amount', 'Percentage'].includes(body.split_by) && Array.isArray(body.splits) && body.splits.length > 0 && body.splits.length <= 5, 'A bounded synthetic payment split is required.')
          const seen = new Set()
          splits = body.splits.map((split, index) => {
            shape(split, ['uuid', 'name', 'priority', 'split_amount'])
            const account = own(state.bankAccounts, split.uuid)
            requireInput(account?.employee_uuid === employee.uuid && !seen.has(split.uuid), 'Payment splits must use distinct bank fixtures owned by this employee.')
            seen.add(split.uuid)
            requireInput(split.priority === index + 1, 'Payment split priorities must be unique and sequential.')
            requireInput(split.split_amount === null || (Number.isInteger(split.split_amount) && split.split_amount >= 0 && split.split_amount <= 2_147_483_647), 'Use a bounded synthetic split amount.')
            return { uuid: account.uuid, name: account.name, hidden_account_number: account.hidden_account_number,
              priority: split.priority, split_amount: split.split_amount }
          })
          requireInput(body.split_by === 'Percentage' ? splits.every(split => split.split_amount !== null) && splits.reduce((sum, split) => sum + split.split_amount, 0) === 100 :
            splits.at(-1).split_amount === null && splits.filter(split => split.split_amount === null).length === 1, 'Split percentages must total 100, or the last amount must capture the remainder.')
        } else requireInput((body.split_by == null) && (body.splits == null || (Array.isArray(body.splits) && body.splits.length === 0)), 'Check payment cannot contain bank splits.')
        Object.assign(row, { version: version(row), type: body.type, split_by: body.type === 'Check' ? null : body.split_by, splits })
        employee.payment_method = row.type
        state.onboardingSaved[employee.uuid].payment = true
        changed(employee)
        return answer(200, row)
      }
      if (resource === 'bank_accounts') {
        if (method === 'GET' && !match[3]) return answer(200, rows(state.bankAccounts, employee.uuid))
        if (method === 'DELETE' && match[3]) {
          const account = own(state.bankAccounts, match[3])
          if (account?.employee_uuid !== employee.uuid) return notFound()
          if (state.paymentMethods[employee.uuid].splits?.some(split => split.uuid === account.uuid)) return error(409, 'mock_bank_in_use', 'Remove the synthetic account from payment splits before deleting it.')
          delete state.bankAccounts[account.uuid]
          return answer(204, null)
        }
        if (method !== 'POST' || match[3]) return methodDenied()
        shape(body, ['routing_number', 'account_number', 'account_type', 'name'])
        requireInput(body.routing_number === '000000000' && body.account_number === '0000000000', 'Only fixed zero bank placeholders are accepted; real bank details are refused.')
        requireInput(['Checking', 'Savings'].includes(body.account_type) && text(body.name), 'Use a supported account type and a bounded synthetic name.')
        requireInput(rows(state.bankAccounts, employee.uuid).length < 5, 'The session is limited to five bank fixtures per employee.')
        const account = { uuid: id('bankAccount'), employee_uuid: employee.uuid, account_type: body.account_type,
          name: body.name, routing_number: '000000000', hidden_account_number: '****0000' }
        state.bankAccounts[account.uuid] = account
        return answer(201, account)
      }
      if (resource === 'garnishments') {
        if (method === 'GET') return answer(200, rows(state.garnishments, employee.uuid))
        if (method !== 'POST') return methodDenied()
        return saveGarnishment({ employee, state, body, id, answer })
      }
    }
    if (path === '/v1/garnishments/child_support') return error(501, 'mock_endpoint_not_implemented', 'Legal child support orders are outside the synthetic administrative fixture.')
    if ((match = /^\/v1\/(home_addresses|work_addresses|jobs|compensations|garnishments)\/([^/]+)(?:\/(compensations))?$/.exec(path))) {
      const [resource, resourceId, nested] = match.slice(1)
      const mapName = { home_addresses: 'homeAddresses', work_addresses: 'workAddresses', jobs: 'jobs', compensations: 'compensations', garnishments: 'garnishments' }[resource]
      const row = own(state[mapName], resourceId)
      const employee = row && employeeFor(row.employee_uuid)
      if (!employee) return notFound()
      if (method !== 'GET' && !editable(employee)) return error(409, 'mock_employee_inactive', 'Terminated fixture employees cannot be changed.')
      if (resource === 'jobs' && nested) {
        if (method !== 'POST') return methodDenied()
        validateCompensation(body)
        requireInput(Object.values(state.compensations).filter(comp => comp.job_uuid === row.uuid).length < 10, 'The session is limited to ten compensations per job.')
        const compensation = { ...body, uuid: id('compensation'), version: 'mock-v1', job_uuid: row.uuid,
          employee_uuid: employee.uuid, title: body.title ?? row.title, effective_date: body.effective_date ?? row.hire_date,
          rate: formatMoney(body.rate), minimum_wages: [], adjust_for_minimum_wage: body.adjust_for_minimum_wage ?? false }
        state.compensations[compensation.uuid] = compensation
        state.onboardingSaved[employee.uuid].compensations[compensation.uuid] = true
        changed(employee)
        row.current_compensation_uuid = compensation.uuid
        updateJobCompensations(row)
        return answer(201, publicCompensation(compensation))
      }
      if (nested) return null
      if (method === 'GET') return answer(200, resource === 'compensations' ? publicCompensation(row) : row)
      if (method === 'DELETE' && ['jobs', 'compensations'].includes(resource)) {
        if (employee.onboarded) return error(409, 'mock_delete_blocked', 'Reopen synthetic onboarding before removing accepted compensation records.')
        delete state[mapName][row.uuid]
        changed(employee)
        if (resource === 'jobs') {
          for (const comp of Object.values(state.compensations).filter(comp => comp.job_uuid === row.uuid)) delete state.compensations[comp.uuid]
          const remaining = rows(state.jobs, employee.uuid)
          if (remaining.length && !remaining.some(job => job.primary)) remaining[0].primary = true
          syncEmployeeJobs(employee)
        } else {
          const job = own(state.jobs, row.job_uuid)
          if (job.current_compensation_uuid === row.uuid) job.current_compensation_uuid = null
          updateJobCompensations(job)
        }
        return answer(204, null)
      }
      if (method !== 'PUT') return methodDenied()
      if (!checkVersion(row)) return conflict()
      if (resource === 'home_addresses') {
        validateAddress(body, row)
        Object.assign(row, body, { version: version(row), country: 'USA' })
        changed(employee)
        return answer(200, row)
      }
      if (resource === 'work_addresses') {
        shape(body, ['version', 'location_uuid', 'effective_date'])
        const location = own(state.locations, body.location_uuid ?? row.location_uuid)
        requireInput(location?.company_uuid === state.companyId, 'Select this synthetic company\'s work location.')
        if ('effective_date' in body) requireInput(date(body.effective_date), 'Use a valid work address start date when supplied.')
        Object.assign(row, copy(location), { ...body, uuid: row.uuid, employee_uuid: employee.uuid,
          version: version(row), location_uuid: location.uuid })
        changed(employee)
        return answer(200, row)
      }
      if (resource === 'jobs') {
        validateJob(body, row)
        const previousTitle = row.title
        Object.assign(row, body, { version: version(row) })
        const currentCompensation = own(state.compensations, row.current_compensation_uuid)
        if (currentCompensation && row.title !== previousTitle) Object.assign(currentCompensation, { title: row.title, version: version(currentCompensation) })
        changed(employee)
        updateJobCompensations(row)
        return answer(200, row)
      }
      if (resource === 'compensations') {
        validateCompensation(body, row)
        Object.assign(row, body, { version: version(row), rate: formatMoney(body.rate ?? row.rate) })
        state.onboardingSaved[employee.uuid].compensations[row.uuid] = true
        changed(employee)
        updateJobCompensations(own(state.jobs, row.job_uuid))
        return answer(200, publicCompensation(row))
      }
      if (resource === 'garnishments') return saveGarnishment({ employee, state, body, id, answer, existing: row })
    }
    return null
  } catch (cause) {
    if (cause instanceof InvalidMockInput) return error(422, 'mock_only_validation', cause.message)
    throw cause
  }
}

function publicCompensation(compensation) {
  const { saved: internalSaved, ...wire } = compensation
  return wire
}

function saveGarnishment({ employee, state, body, id, answer, existing }) {
  shape(body, ['version', 'active', 'amount', 'description', 'court_ordered', 'garnishment_type', 'times', 'recurring',
    'annual_maximum', 'pay_period_maximum', 'deduct_as_percentage', 'total_amount', 'child_support'])
  const combined = { active: true, court_ordered: false, times: null, recurring: true, annual_maximum: null,
    pay_period_maximum: null, deduct_as_percentage: false, total_amount: null, garnishment_type: null, child_support: null, ...existing, ...body }
  requireInput(money(combined.amount), 'Use a bounded nonnegative synthetic deduction amount.')
  requireInput(combined.court_ordered === false && combined.child_support == null && combined.garnishment_type == null,
    'Legal orders and child support are outside the tested synthetic deduction fixture.')
  for (const field of ['active', 'recurring', 'deduct_as_percentage']) requireInput(typeof combined[field] === 'boolean', `${field} must be boolean.`)
  if (combined.description != null) requireInput(text(combined.description), 'Use a bounded synthetic deduction description.')
  if (combined.times != null) requireInput(Number.isInteger(combined.times) && combined.times > 0 && combined.times <= 1000, 'times must be a bounded positive integer.')
  for (const field of ['annual_maximum', 'pay_period_maximum', 'total_amount']) if (combined[field] != null) requireInput(money(combined[field]), 'Use bounded synthetic deduction maximums.')
  requireInput(!combined.deduct_as_percentage || Number(combined.amount) <= 100, 'Deduction percentages cannot exceed 100.')
  requireInput(existing || rows(state.garnishments, employee.uuid).length < 10, 'The session is limited to ten deductions per employee.')
  const row = { ...combined, uuid: existing?.uuid ?? id('garnishment'), employee_uuid: employee.uuid,
    version: existing ? version(existing) : 'mock-v1', amount: formatMoney(combined.amount) }
  state.garnishments[row.uuid] = row
  employee.garnishments = rows(state.garnishments, employee.uuid)
  return answer(existing ? 200 : 201, row)
}
