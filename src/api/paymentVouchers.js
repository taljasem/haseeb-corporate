/**
 * Payment Vouchers API module — AUDIT-ACC-002 (2026-04-22).
 *
 * Wraps the 13 endpoints exposed by corporate-api's payment-vouchers
 * module (`src/modules/payment-vouchers/payment-vouchers.routes.ts`). The
 * router mounts under `/api/payment-vouchers` and drives the AP
 * vendor-payment workflow (FN-274).
 *
 * Lifecycle (8 states, 7 transitions):
 *   DRAFT
 *     → submit → PENDING_REVIEW
 *                → review → PENDING_APPROVAL
 *                           → approve → PENDING_SIGNATORIES (cheque methods)
 *                                     | APPROVED             (cash/transfer)
 *                                     → sign (all) → APPROVED
 *                                                    → mark-paid → PAID
 *   Any pre-terminal → reject (reason) → REJECTED
 *   Any pre-PAID     → cancel (reason) → CANCELLED
 *
 * Separation of duties (enforced backend-side):
 *   preparedBy ≠ reviewedBy ≠ approvedBy  (ValidationError on violation).
 *
 * Cheque-method branch: CHEQUE_IMMEDIATE | CHEQUE_POST_DATED trigger
 *   PENDING_SIGNATORIES at approve-time + create a linked FN-228
 *   Cheque entity; voucher.chequeId points at it. BANK_TRANSFER_KNET +
 *   CASH bypass the signatory gate → straight to APPROVED, no cheque.
 *
 * Mandate linkage: CHEQUE_* and BANK_TRANSFER_* methods REQUIRE a
 *   bankAccountMandateId on create. Mandate must NOT be CANCELLED at
 *   create-time. Mandate-rules signatory count is evaluated at
 *   approve-time against the assigned signatories snapshot. HASEEB-274
 *   surface: compare Σ(requires[].count) >= 2 on composer.
 *
 * Response envelope: controller returns `successResponse(narrowed)` which
 *   unwrap()s to the narrowed object / list. List responses are
 *   `{ rowCount, rows }`; the legacy mock-engine namespace sometimes calls
 *   these `{ vouchers }` or similar — this module returns exactly the
 *   backend shape; callers (screens) consume `{ rows }` directly.
 *
 * Errors are normalised by client.js into `{ ok:false, status, code, message }`.
 */
import client from './client';

function unwrap(response) {
  if (response && response.data && typeof response.data === 'object') {
    if ('data' in response.data && 'success' in response.data) {
      return response.data.data;
    }
    return response.data;
  }
  return response?.data;
}

// ── Vouchers ─────────────────────────────────────────────────────────

/**
 * List payment vouchers. All authenticated roles can read.
 *
 * @param {{ status?: 'DRAFT'|'PENDING_REVIEW'|'PENDING_APPROVAL'|'PENDING_SIGNATORIES'|'APPROVED'|'PAID'|'REJECTED'|'CANCELLED',
 *          beneficiaryType?: 'Vendor'|'Employee'|'Other',
 *          beneficiaryId?: string,
 *          paymentMethod?: 'CHEQUE_IMMEDIATE'|'CHEQUE_POST_DATED'|'BANK_TRANSFER_KNET'|'CASH',
 *          preparedBy?: string,
 *          approvedBy?: string,
 *          mandateId?: string,
 *          limit?: number }} [filter]
 * @returns {Promise<{ rowCount: number, rows: Array }>}
 */
export async function listVouchers(filter = {}) {
  const params = {};
  if (filter.status) params.status = filter.status;
  if (filter.beneficiaryType) params.beneficiaryType = filter.beneficiaryType;
  if (filter.beneficiaryId) params.beneficiaryId = filter.beneficiaryId;
  if (filter.paymentMethod) params.paymentMethod = filter.paymentMethod;
  if (filter.preparedBy) params.preparedBy = filter.preparedBy;
  if (filter.approvedBy) params.approvedBy = filter.approvedBy;
  if (filter.mandateId) params.mandateId = filter.mandateId;
  if (filter.limit != null) params.limit = String(filter.limit);
  const r = await client.get('/api/payment-vouchers', { params });
  const data = unwrap(r);
  if (data && Array.isArray(data.rows)) {
    return { rowCount: data.rowCount ?? data.rows.length, rows: data.rows };
  }
  if (Array.isArray(data)) return { rowCount: data.length, rows: data };
  return { rowCount: 0, rows: [] };
}

/** Detail by id. Response carries the voucher row directly — signatories
 *  are an inline JSON array on the row; chequeId is a pointer to the
 *  linked Cheque (if cheque method post-approval); lifecycle timestamps +
 *  actors (preparedBy / reviewedBy / approvedBy / rejectedBy /
 *  cancelledBy + Atomic At fields) serve as the audit trail surface. */
export async function getVoucher(id) {
  if (!id) throw new Error('getVoucher: id is required');
  const r = await client.get(
    `/api/payment-vouchers/${encodeURIComponent(id)}`,
  );
  return unwrap(r);
}

/**
 * Create a DRAFT voucher. OWNER / ACCOUNTANT only.
 *
 * @param {{
 *   beneficiaryType: 'Vendor'|'Employee'|'Other',
 *   beneficiaryId: string,
 *   beneficiaryNameSnapshot: string,
 *   amountKwd: string,                 // KWD Decimal 3dp, e.g. "5000.000"
 *   paymentMethod: string,             // see 4 fixed keys
 *   issueDate: string,                 // YYYY-MM-DD
 *   description?: string | null,
 *   bankAccountMandateId?: string | null
 * }} body
 */
export async function createVoucher(body) {
  const r = await client.post('/api/payment-vouchers', body);
  return unwrap(r);
}

/** Patch a DRAFT voucher. OWNER / ACCOUNTANT only. All fields optional. */
export async function patchVoucher(id, patch) {
  if (!id) throw new Error('patchVoucher: id is required');
  const r = await client.patch(
    `/api/payment-vouchers/${encodeURIComponent(id)}`,
    patch || {},
  );
  return unwrap(r);
}

/** DRAFT → PENDING_REVIEW. OWNER / ACCOUNTANT. */
export async function submitVoucher(id) {
  if (!id) throw new Error('submitVoucher: id is required');
  const r = await client.post(
    `/api/payment-vouchers/${encodeURIComponent(id)}/submit`,
  );
  return unwrap(r);
}

/** PENDING_REVIEW → PENDING_APPROVAL. OWNER / ACCOUNTANT (SoD enforced). */
export async function reviewVoucher(id) {
  if (!id) throw new Error('reviewVoucher: id is required');
  const r = await client.post(
    `/api/payment-vouchers/${encodeURIComponent(id)}/review`,
  );
  return unwrap(r);
}

/** PENDING_APPROVAL → PENDING_SIGNATORIES (cheque) | APPROVED. OWNER / ACCOUNTANT. */
export async function approveVoucher(id) {
  if (!id) throw new Error('approveVoucher: id is required');
  const r = await client.post(
    `/api/payment-vouchers/${encodeURIComponent(id)}/approve`,
  );
  return unwrap(r);
}

/**
 * Assign signatories (1–10) to a PENDING_SIGNATORIES voucher.
 * @param {string} id
 * @param {string[]} userIds
 */
export async function assignSignatories(id, userIds) {
  if (!id) throw new Error('assignSignatories: id is required');
  if (!Array.isArray(userIds) || userIds.length < 1 || userIds.length > 10) {
    throw new Error('assignSignatories: userIds must be a 1..10 array');
  }
  const r = await client.post(
    `/api/payment-vouchers/${encodeURIComponent(id)}/assign-signatories`,
    { userIds },
  );
  return unwrap(r);
}

/** Record a single signatory's signature. Transitions to APPROVED when all signed. */
export async function signVoucher(id, signatoryUserId) {
  if (!id) throw new Error('signVoucher: id is required');
  if (!signatoryUserId) throw new Error('signVoucher: signatoryUserId is required');
  const r = await client.post(
    `/api/payment-vouchers/${encodeURIComponent(id)}/sign`,
    { signatoryUserId },
  );
  return unwrap(r);
}

/** APPROVED → PAID. Posts cash-out JE via journalEntryService.create. */
export async function markVoucherPaid(id) {
  if (!id) throw new Error('markVoucherPaid: id is required');
  const r = await client.post(
    `/api/payment-vouchers/${encodeURIComponent(id)}/mark-paid`,
  );
  return unwrap(r);
}

/** Any pre-terminal → REJECTED. Reason required. */
export async function rejectVoucher(id, reason) {
  if (!id) throw new Error('rejectVoucher: id is required');
  if (!reason || !String(reason).trim()) {
    throw new Error('rejectVoucher: reason is required');
  }
  const r = await client.post(
    `/api/payment-vouchers/${encodeURIComponent(id)}/reject`,
    { reason: String(reason) },
  );
  return unwrap(r);
}

/** Any pre-PAID → CANCELLED. Reason required. Post-APPROVED OWNER-only (svc). */
export async function cancelVoucher(id, reason) {
  if (!id) throw new Error('cancelVoucher: id is required');
  if (!reason || !String(reason).trim()) {
    throw new Error('cancelVoucher: reason is required');
  }
  const r = await client.post(
    `/api/payment-vouchers/${encodeURIComponent(id)}/cancel`,
    { reason: String(reason) },
  );
  return unwrap(r);
}

/** Read-only Aminah status summary. OWNER / ACCOUNTANT / AUDITOR. */
export async function getVoucherAminahStatus(query = {}) {
  const params = {};
  if (query.intent) params.intent = query.intent;
  if (query.userId) params.userId = query.userId;
  if (query.bankName) params.bankName = query.bankName;
  if (query.accountReference) params.accountReference = query.accountReference;
  if (query.chequeNumber) params.chequeNumber = query.chequeNumber;
  if (query.windowDays != null) params.windowDays = String(query.windowDays);
  if (query.expiryWindowDays != null) params.expiryWindowDays = String(query.expiryWindowDays);
  if (query.limit != null) params.limit = String(query.limit);
  const r = await client.get('/api/payment-vouchers/aminah-status', { params });
  return unwrap(r);
}
