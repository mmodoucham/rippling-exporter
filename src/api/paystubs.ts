import { paystubListSchema, type PaystubRecord } from '../schema.js'
import { apiRequest, type RipplingSession } from './client.js'

const BASE = 'https://app.rippling.com/api/international_payroll/get_pay_stubs/'

export async function listPaystubs(
  session: RipplingSession,
  fetchImpl: typeof fetch = fetch,
): Promise<readonly PaystubRecord[]> {
  const url = `${BASE}?roleId=${encodeURIComponent(session.roleId)}`
  return apiRequest(session, url, paystubListSchema, { method: 'GET' }, fetchImpl)
}
