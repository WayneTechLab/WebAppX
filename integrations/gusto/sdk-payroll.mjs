const rowKeys = ['employee_uuid', 'version', 'excluded', 'payment_method', 'memo', 'fixed_compensations', 'hourly_compensations', 'paid_time_off', 'reimbursements', 'deductions']
const objectWithKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key))
const decimal = value => (typeof value === 'number' || typeof value === 'string' && /^\d+(?:\.\d{1,3})?$/.test(value)) && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 1000000
const money = value => Number(value).toFixed(2)

export function handlePayroll({ method, path, query, body, state, respond, error, now }) {
  const companyRoot = `/v1/companies/${state.companyId}`
  const payrollRoot = `${companyRoot}/payrolls/${state.payroll.uuid}`
  const payroll = state.payroll
  if (path === `/v1/payrolls/${payroll.uuid}/receipt`) {
    if (method !== 'GET') return error(403, 'mock_method_denied', 'Synthetic payroll receipts support reads only.')
    if (query.size) return error(422, 'invalid_attribute_value', 'Synthetic payroll receipts do not accept query options.')
    if (state.payrollPhase !== 'submitted' || !state.receipt || !payroll.totals) return error(409, 'invalid_operation', 'Submit this synthetic payroll before reading its fictional receipt.')
    return respond(200, {
      payroll_uuid: payroll.uuid, company_uuid: state.companyId,
      name_of_sender: 'Fictional Demo Employer — local mock only', name_of_recipient: 'Fictional payroll recipients',
      recipient_notice: state.receipt.notice, debit_date: new Date(payroll.payroll_deadline).toISOString().slice(0, 10),
      license: 'Synthetic receipt only. No licensed processing or funds movement occurred.', license_uri: '/hr/demo/sdk',
      right_to_refund: 'No payment occurred; this fictional receipt creates no refund right.',
      liability_of_licensee: 'No provider account, filing, banking connection or legal submission exists in this mock.',
      totals: { company_debit: payroll.totals.company_debit, net_pay_debit: payroll.totals.net_pay_debit,
        child_support_debit: '0.00', reimbursement_debit: '0.00', tax_debit: '0.00' },
      taxes: [],
      employee_compensations: payroll.employee_compensations.filter(row => !row.excluded).map(row => {
        const person = state.employees.find(employee => employee.uuid === row.employee_uuid)
        return { employee_uuid: row.employee_uuid, employee_first_name: person.first_name, employee_last_name: person.last_name,
          payment_method: row.payment_method, net_pay: row.net_pay, total_tax: '0.00', total_garnishments: '0.00',
          child_support_garnishment: '0.00', total_reimbursement: '0.00' }
      }),
      licensee: { name: 'Fictional local mock processor', address: '100 Fictional Lane', city: 'Austin', state: 'TX', postal_code: '78701', phone_number: '0000000000' },
    })
  }
  if (path === `${companyRoot}/bank_accounts` && method === 'GET') return respond(200, state.payrollFixture.bankAccounts)
  if (path === `${companyRoot}/payment_configs` && method === 'GET') return respond(200, state.payrollFixture.paymentConfig)
  if (path === `${companyRoot}/pay_schedules/${state.payrollFixture.paySchedule.uuid}` && method === 'GET') return respond(200, state.payrollFixture.paySchedule)
  if (path === `${companyRoot}/payrolls/blockers` && method === 'GET') return respond(200, [])
  if (path === `${companyRoot}/payrolls` && method === 'GET') return respond(200, [payroll])
  if (!path.startsWith(payrollRoot)) return null
  if (path === payrollRoot && method === 'GET') {
    if (state.payrollPhase === 'calculated' && query.get('include')?.split(',').includes('totals')) state.payrollReviewed = true
    return respond(200, payroll)
  }
  if (method !== 'PUT') return error(403, 'mock_method_denied', 'This synthetic payroll endpoint supports only its reviewed methods.')
  if (state.payrollPhase === 'submitted') return error(409, 'invalid_operation', 'The fake payroll was already submitted. Reset this session before another submission.')

  if (path === `${payrollRoot}/prepare`) {
    if (!objectWithKeys(body ?? {}, ['employee_uuids'])) return error(422, 'invalid_attribute_value', 'Unexpected payroll preparation fields.')
    const selected = body?.employee_uuids ?? payroll.employee_compensations.map(row => row.employee_uuid)
    const current = new Set(payroll.employee_compensations.map(row => row.employee_uuid))
    if (!Array.isArray(selected) || !selected.length || selected.length > 100 || new Set(selected).size !== selected.length || selected.some(id => !current.has(id))) {
      return error(422, 'invalid_attribute_value', 'Select only the eligible synthetic payroll roster.')
    }
    state.payrollPhase = 'prepared'; state.payrollReviewed = false; payroll.calculated_at = null; payroll.processing_request = null; delete payroll.totals
    for (const row of payroll.employee_compensations) { row.version = `mock-payroll-row-${++state.payrollRevision}`; row.excluded = !selected.includes(row.employee_uuid) }
    return respond(200, payroll)
  }

  if (path === payrollRoot) {
    if (!['prepared', 'calculated'].includes(state.payrollPhase)) return error(409, 'invalid_operation', 'Prepare the fake payroll before editing it.')
    if (!objectWithKeys(body, ['employee_compensations']) || !Array.isArray(body.employee_compensations) || !body.employee_compensations.length || body.employee_compensations.length > 100) return error(422, 'invalid_attribute_value', 'Provide a bounded employee compensation update.')
    const patches = []
    const seen = new Set()
    for (const patch of body.employee_compensations) {
      if (!objectWithKeys(patch, rowKeys) || seen.has(patch.employee_uuid)) return error(422, 'invalid_attribute_value', 'Invalid or duplicated payroll row.')
      seen.add(patch.employee_uuid)
      const current = payroll.employee_compensations.find(row => row.employee_uuid === patch.employee_uuid)
      if (!current) return error(404, 'not_found', 'The synthetic employee is not in this payroll.')
      if (patch.version !== current.version) return error(409, 'stale_version', 'Retrieve the current synthetic payroll row version before retrying.')
      if (patch.excluded != null && typeof patch.excluded !== 'boolean' || patch.payment_method != null && !['Check', 'Direct Deposit'].includes(patch.payment_method) || patch.memo != null && (typeof patch.memo !== 'string' || patch.memo.length > 200)) return error(422, 'invalid_attribute_value', 'Invalid payroll row values.')
      for (const key of ['fixed_compensations', 'hourly_compensations', 'paid_time_off', 'reimbursements', 'deductions']) if (patch[key] != null && (!Array.isArray(patch[key]) || patch[key].length > 20)) return error(422, 'invalid_attribute_value', 'Payroll compensation arrays must be bounded.')
      if (patch.deductions?.length || patch.paid_time_off?.length || patch.reimbursements?.length) return error(422, 'mock_capability_not_implemented', 'This zero-tax mock covers regular hours, fixed earnings and exclusions; deductions, PTO and reimbursements need a separate tested scenario.')
      if (patch.hourly_compensations?.some(item => !objectWithKeys(item, ['name', 'job_uuid', 'hours', 'amount', 'compensation_multiplier', 'flsa_status']) || !decimal(item.hours) || Number(item.hours) > 240 || !['Regular Hours', 'Overtime', 'Double Overtime'].includes(item.name) || !current.hourly_compensations.some(row => row.job_uuid === item.job_uuid) || item.compensation_multiplier != null && ![1, 1.5, 2].includes(item.compensation_multiplier))) return error(422, 'invalid_attribute_value', 'Use valid bounded hours for this employee job.')
      if (patch.fixed_compensations?.some(item => !objectWithKeys(item, ['name', 'job_uuid', 'amount']) || typeof item.name !== 'string' || item.name.length > 80 || !decimal(item.amount) || item.job_uuid != null && !current.hourly_compensations.some(row => row.job_uuid === item.job_uuid))) return error(422, 'invalid_attribute_value', 'Invalid synthetic fixed compensation.')
      patches.push({ current, patch })
    }
    for (const { current, patch } of patches) Object.assign(current, structuredClone(patch), { version: `mock-payroll-row-${++state.payrollRevision}` })
    state.payrollPhase = 'prepared'; state.payrollReviewed = false; payroll.calculated_at = null; payroll.processing_request = null; delete payroll.totals
    return respond(200, payroll)
  }

  if (path === `${payrollRoot}/calculate`) {
    if (!objectWithKeys(body ?? {}, [])) return error(422, 'invalid_attribute_value', 'Synthetic calculation does not accept extra fields.')
    if (!['prepared', 'calculated'].includes(state.payrollPhase)) return error(409, 'invalid_operation', 'Prepare the fake payroll before calculating it.')
    let gross = 0, check = 0
    for (const row of payroll.employee_compensations) {
      const employee = state.employees.find(person => person.uuid === row.employee_uuid)
      const job = employee?.jobs?.find(job => job.primary)
      const rate = Number(job?.compensations?.[0]?.rate ?? 25)
      for (const item of row.hourly_compensations) item.amount = money(row.excluded ? 0 : Number(item.hours) * rate * (item.compensation_multiplier ?? (item.name === 'Overtime' ? 1.5 : item.name === 'Double Overtime' ? 2 : 1)))
      const amount = row.excluded ? 0 : row.hourly_compensations.reduce((sum, item) => sum + Number(item.amount), 0) + row.fixed_compensations.reduce((sum, item) => sum + Number(item.amount), 0)
      row.gross_pay = money(amount); row.net_pay = money(amount); row.check_amount = row.payment_method === 'Check' ? money(amount) : '0.00'; row.taxes = []; row.benefits = []
      gross += amount; check += Number(row.check_amount)
    }
    // This deliberately illustrative zero-tax scenario is never tax or net-pay authority.
    payroll.totals = {
      gross_pay: money(gross), net_pay: money(gross), company_debit: money(gross - check), net_pay_debit: money(gross - check), check_amount: money(check),
      tax_debit: '0.00', employee_taxes: '0.00', employer_taxes: '0.00', employee_benefits_deductions: '0.00', benefits: '0.00', reimbursements: '0.00', reimbursement_debit: '0.00', other_deductions: '0.00', child_support_debit: '0.00', additional_earnings: '0.00', employee_bonuses: '0.00', employee_commissions: '0.00', employee_cash_tips: '0.00', employee_paycheck_tips: '0.00', imputed_pay: '0.00', owners_draw: '0.00', deferred_payroll_taxes: '0.00',
    }
    state.lastCalculated = Math.max(now(), (state.lastCalculated ?? 0) + 1)
    payroll.calculated_at = new Date(state.lastCalculated).toISOString(); payroll.processing_request = { status: 'calculate_success', errors: [] }; state.payrollPhase = 'calculated'; state.payrollReviewed = false
    return respond(202, null)
  }

  if (path === `${payrollRoot}/submit`) {
    if (!objectWithKeys(body ?? {}, ['submission_blockers']) || body?.submission_blockers != null && (!Array.isArray(body.submission_blockers) || body.submission_blockers.length)) return error(422, 'invalid_attribute_value', 'No synthetic blockers may be bypassed.')
    if (state.payrollPhase !== 'calculated' || !payroll.calculated_at || !state.payrollReviewed) return error(409, 'invalid_operation', 'Calculate and retrieve the review totals for this fake payroll before submitting it.')
    payroll.processed = true; payroll.processed_date = new Date(now()).toISOString().slice(0, 10); payroll.processing_request = { status: 'submit_success', errors: [] }
    state.payrollPhase = 'submitted'; state.receipt = { mode: 'mock', payrollId: payroll.uuid, state: 'fake-submitted', gross: payroll.totals.gross_pay, notice: 'Synthetic test receipt only. No wages, taxes, bank transfer or Gusto submission occurred.' }
    return respond(202, null)
  }
  return error(501, 'mock_endpoint_not_implemented', 'This endpoint is outside the tested synthetic payroll journey.')
}
