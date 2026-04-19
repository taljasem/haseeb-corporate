/**
 * Bills (AP) API module — Phase 4 Wave 1 Track B.
 *
 * Wraps the subset of /api/bills endpoints that AgingReportsScreen
 * exercises on the AP side:
 *   POST /api/bills/:id/payment → recordBillPayment(id, body)
 *
 * Pay-now only — the backend has no future-dated scheduling surface,
 * so SchedulePaymentModal stays mock (see mockEngine.js comment block).
 */
import client from './client';

function unwrap(response) {
  if (response && response.data && typeof response.data === 'object') {
    if ('data' in response.data) return response.data.data;
    return response.data;
  }
  return response?.data;
}

/**
 * POST /api/bills/:id/payment
 *
 * Backend schema (recordBillPaymentSchema):
 *   { amount: number, date: string (ISO), bankAccountId: uuid, reference?: string }
 *
 * Role gate: authenticated (no explicit requireRole on the route at
 * time of writing; service layer enforces via auth middleware).
 */
export async function recordBillPayment(id, body) {
  if (!id) throw new Error('recordBillPayment: billId is required');
  const payload = {
    amount: Number(body?.amount ?? 0),
    date: body?.date || new Date().toISOString().slice(0, 10),
    bankAccountId: body?.bankAccountId,
    reference: body?.reference || undefined,
  };
  if (!payload.bankAccountId) {
    throw new Error(
      'recordBillPayment: bankAccountId is required by the Corporate API schema',
    );
  }
  const r = await client.post(
    `/api/bills/${encodeURIComponent(id)}/payment`,
    payload,
  );
  return unwrap(r);
}
