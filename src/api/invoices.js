/**
 * Invoices API module — Phase 4 Wave 1 Track B.
 *
 * Wraps the subset of /api/invoices endpoints that AgingReportsScreen
 * modals exercise:
 *   GET  /api/invoices/:id             → getInvoice(id)
 *   POST /api/invoices/:id/payment     → recordInvoicePayment(id, body)
 *
 * See memory-bank/2026-04-19-phase4-breakdown.md §B-Tier 2 for the
 * wire plan this module enables.
 *
 * Note: POST /api/invoices/:id/credit-note is a real backend surface
 * (shipped Wave 1 invoices module) but is NOT wrapped here because the
 * only current consumer (WriteOffModal) needs GL-flexible write-off
 * semantics that the Revenue-only credit-note path cannot provide. A
 * future Phase 4 dispatch that surfaces credit-note-as-such (not as a
 * write-off proxy) will add the wrapper then. See HASEEB-068/069.
 */
import client from './client';

function unwrap(response) {
  if (response && response.data && typeof response.data === 'object') {
    if ('data' in response.data) return response.data.data;
    return response.data;
  }
  return response?.data;
}

function num(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function statusFromApi(apiStatus, outstanding) {
  const s = String(apiStatus || '').toUpperCase();
  if (s === 'VOID' || s === 'VOIDED') return 'written_off';
  if (s === 'PAID' || outstanding <= 0) return 'paid';
  if (s === 'PARTIALLY_PAID' || s === 'PARTIAL') return 'partial';
  if (s === 'DISPUTED') return 'disputed';
  return 'outstanding';
}

/**
 * Adapt a full Invoice DTO to the mock shape that InvoiceDetailSlideOver
 * expects. The slide-over reads:
 *   inv.invoiceNumber, inv.partyName, inv.type,
 *   inv.invoiceDate, inv.dueDate, inv.daysOverdue,
 *   inv.amount, inv.outstanding,
 *   inv.lineItems[{description, qty, unitPrice, total}],
 *   inv.partialPayments[{date, amount, method, reference}],
 *   inv.communicationHistory[{type, template?, notes?, by|sentBy, at|sentAt}]
 *
 * The live API returns customer/lines but no payment-history or
 * communication-history surface yet — those render as empty state in
 * the slide-over (the component already has an empty-state branch).
 */
function adaptInvoice(apiInv) {
  if (!apiInv) return null;
  const totalAmount = num(apiInv.totalAmount ?? apiInv.total ?? apiInv.amount);
  const amountPaid = num(apiInv.amountPaid ?? apiInv.paid ?? 0);
  const outstanding = Math.max(0, totalAmount - amountPaid);
  const dueDate = apiInv.dueDate || null;
  const daysOverdue = dueDate
    ? Math.max(
        0,
        Math.floor((Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)),
      )
    : 0;
  const customerName =
    apiInv.customer?.nameEn ||
    apiInv.customer?.name ||
    apiInv.customerName ||
    '';
  return {
    id: String(apiInv.id || apiInv.invoiceNumber || ''),
    type: 'AR',
    partyId: apiInv.customer?.id || apiInv.customerId || '',
    partyName: customerName,
    invoiceNumber: apiInv.invoiceNumber || apiInv.refNumber || '',
    invoiceDate: apiInv.issueDate || apiInv.invoiceDate || apiInv.createdAt || null,
    dueDate,
    daysOverdue,
    amount: totalAmount,
    outstanding,
    status: statusFromApi(apiInv.status, outstanding),
    lineItems: Array.isArray(apiInv.lines)
      ? apiInv.lines.map((l) => ({
          description: l.description || '',
          qty: num(l.quantity),
          unitPrice: num(l.unitPrice),
          total: num(l.quantity) * num(l.unitPrice),
        }))
      : [],
    partialPayments: Array.isArray(apiInv.payments)
      ? apiInv.payments.map((p) => ({
          date: p.date || p.paymentDate || p.createdAt || null,
          amount: num(p.amount),
          method: p.method || 'bank_transfer',
          reference: p.reference || '',
        }))
      : [],
    communicationHistory: [],
    raw: apiInv,
  };
}

/** GET /api/invoices/:id */
export async function getInvoice(id) {
  if (!id) return null;
  const r = await client.get(`/api/invoices/${encodeURIComponent(id)}`);
  return adaptInvoice(unwrap(r));
}

/**
 * POST /api/invoices/:id/payment
 *
 * Backend schema (recordPaymentSchema):
 *   { amount: number, date: string (ISO), bankAccountId: uuid, reference?: string }
 *
 * Role gate: OWNER, ACCOUNTANT.
 *
 * The caller is responsible for passing a real `bankAccountId` (uuid).
 * The LogPaymentModal adds a bank-account picker to satisfy this. If
 * `bankAccountId` is missing, we surface a clear error rather than silently
 * fail or POST a malformed body.
 */
export async function recordInvoicePayment(id, body) {
  if (!id) throw new Error('recordInvoicePayment: invoiceId is required');
  const payload = {
    amount: Number(body?.amount ?? 0),
    date: body?.date || new Date().toISOString().slice(0, 10),
    bankAccountId: body?.bankAccountId,
    reference: body?.reference || undefined,
  };
  if (!payload.bankAccountId) {
    throw new Error(
      'recordInvoicePayment: bankAccountId is required by the Corporate API schema',
    );
  }
  const r = await client.post(
    `/api/invoices/${encodeURIComponent(id)}/payment`,
    payload,
  );
  return unwrap(r);
}

/**
 * POST /api/invoices/:id/write-off
 *
 * Backend (AUDIT-ACC-005, corporate-api 3fdb92c, 2026-04-22):
 *   body  { reason: string 10..500, effectiveDate?: ISO-date,
 *           category?: 'bad_debt'|'goodwill'|'settlement'|'other' }
 *   ->    { invoice, writeOff, journalEntry }
 *
 * Posts DR BAD_DEBT_EXPENSE / CR AR_DEFAULT JE via journalEntryService.create.
 * `category` is accepted + persisted as metadata but does NOT route JE shape
 * in v1 (resolution 2.1(c) per Tarek 2026-04-22; GL-flexibility follow-up
 * tracked as HASEEB-194).
 *
 * Role gate: OWNER, ACCOUNTANT. 409 on invalid state (PAID/VOID/WRITTEN_OFF).
 */
export async function writeOffInvoice(invoiceId, { reason, effectiveDate, category } = {}) {
  if (!invoiceId) throw new Error('writeOffInvoice: invoiceId is required');
  const body = { reason };
  if (effectiveDate) body.effectiveDate = effectiveDate;
  if (category) body.category = category;
  const response = await client.post(
    `/api/invoices/${encodeURIComponent(invoiceId)}/write-off`,
    body,
  );
  return unwrap(response);
}

/**
 * POST /api/invoices/:id/dispute
 *
 * Backend (AUDIT-ACC-005, corporate-api 3fdb92c, 2026-04-22):
 *   body  { reason: string 10..500, disputedAmount?: KWD-string 3dp }
 *   ->    { invoice, dispute }
 *
 * No JE. Status -> DISPUTED. Role gate: OWNER, ACCOUNTANT. 409 on invalid
 * state (PAID/VOID/WRITTEN_OFF can't be disputed).
 */
export async function disputeInvoice(invoiceId, { reason, disputedAmount } = {}) {
  if (!invoiceId) throw new Error('disputeInvoice: invoiceId is required');
  const body = { reason };
  if (disputedAmount !== undefined && disputedAmount !== null && disputedAmount !== '') {
    body.disputedAmount = disputedAmount;
  }
  const response = await client.post(
    `/api/invoices/${encodeURIComponent(invoiceId)}/dispute`,
    body,
  );
  return unwrap(response);
}

/**
 * POST /api/invoices/:id/schedule-payment
 *
 * Backend (AUDIT-ACC-005, corporate-api 3fdb92c, 2026-04-22):
 *   body  { installments: [{dueDate: ISO-date, amount: KWD-string 3dp}] }
 *           (min 2, max 12 installments; sum must equal invoice.outstanding
 *            within 0.001 KWD tolerance)
 *   ->    { invoice, paymentPlan }
 *
 * No JE at creation. Creates InvoicePaymentPlan + installments. Role gate:
 * OWNER, ACCOUNTANT. 409 if invoice has an existing active plan.
 */
export async function scheduleInvoicePaymentPlan(invoiceId, { installments } = {}) {
  if (!invoiceId) throw new Error('scheduleInvoicePaymentPlan: invoiceId is required');
  const response = await client.post(
    `/api/invoices/${encodeURIComponent(invoiceId)}/schedule-payment`,
    { installments },
  );
  return unwrap(response);
}

/**
 * POST /api/invoices/:id/email — HASEEB-420 (2026-04-24, FN-063).
 *
 * Emails a posted invoice to the customer and appends an InvoiceSendLog
 * row. Separate from POST /:id/send (the GL-posting path that transitions
 * DRAFT → SENT with a revenue JE) — this endpoint does NOT post a JE.
 *
 * Backend schema (emailInvoiceSchema, .strict):
 *   {
 *     recipientEmail?: string (email),        // defaults to customer.email server-side
 *     cc?: string[] (email, max 5),
 *     subject?: string (max 300),
 *     message?: string (max 2000),
 *     language?: 'en' | 'ar' | 'bilingual',   // default 'bilingual'
 *   }
 *
 * Role gate: OWNER, ACCOUNTANT. 201 on success → returns the created
 * InvoiceSendLog row.
 *
 * `cc` accepts either an array of emails or a single string (splits on
 * comma+whitespace — common UI pattern where the user types a free-form
 * "a@x, b@y" field). Empty-string / null / undefined fields are stripped
 * from the body so `.strict()` does not reject them.
 *
 * @param {string} invoiceId
 * @param {{recipientEmail?: string, cc?: string|string[], subject?: string,
 *          message?: string, language?: 'en'|'ar'|'bilingual'}} payload
 * @returns {Promise<object>} InvoiceSendLog row (id, recipientEmail,
 *          cc[], subject, language, sentAt, status, …).
 */
export async function emailInvoice(invoiceId, payload = {}) {
  if (!invoiceId) throw new Error('emailInvoice: invoiceId is required');
  const body = {};
  if (payload.recipientEmail) body.recipientEmail = payload.recipientEmail;
  if (payload.cc !== undefined && payload.cc !== null && payload.cc !== '') {
    const ccList = Array.isArray(payload.cc)
      ? payload.cc
      : String(payload.cc)
          .split(/[,\s]+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
    if (ccList.length > 0) body.cc = ccList;
  }
  if (payload.subject) body.subject = payload.subject;
  if (payload.message) body.message = payload.message;
  if (payload.language) body.language = payload.language;
  const response = await client.post(
    `/api/invoices/${encodeURIComponent(invoiceId)}/email`,
    body,
  );
  return unwrap(response);
}

/**
 * GET /api/invoices/:id/send-logs — HASEEB-420 (2026-04-24, FN-063).
 *
 * Returns all send-log rows for an invoice, descending by sentAt. Read-
 * only; no role gate beyond authentication (same posture as invoice
 * list / detail).
 *
 * @param {string} invoiceId
 * @returns {Promise<Array<object>>} Send-log rows (may be empty array).
 */
export async function getInvoiceSendLogs(invoiceId) {
  if (!invoiceId) throw new Error('getInvoiceSendLogs: invoiceId is required');
  const response = await client.get(
    `/api/invoices/${encodeURIComponent(invoiceId)}/send-logs`,
  );
  const rows = unwrap(response);
  return Array.isArray(rows) ? rows : [];
}

