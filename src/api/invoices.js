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

