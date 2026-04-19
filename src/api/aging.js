/**
 * Aging reports API module — Phase 4 Wave 1 Track B first wire.
 *
 * Maps the Corporate API's per-module aging endpoints to the mock shape
 * that AgingReportsScreen expects. See memory-bank/2026-04-19-phase4-breakdown.md
 * §B-Tier 2 for the coverage analysis.
 *
 * Mock shape (from mockEngine.js:6271 getAgingReport):
 *   {
 *     type: "AR" | "AP",
 *     asOfDate: ISO string,
 *     totals: { current, b1_30, b31_60, b61_90, b90_plus, total },
 *     counts: { current, b1_30, b31_60, b61_90, b90_plus, total },
 *     invoices: [ { id, type, partyId, partyName, invoiceNumber,
 *                   invoiceDate, dueDate, daysOverdue, amount,
 *                   outstanding, status, bucket, partialPayments[],
 *                   communicationHistory[], lineItems[] } ],
 *     dso: number | null,   // AR only
 *     dpo: number | null,   // AP only
 *     trend: [ { month, current, b1_30, b31_60, b61_90, b90_plus, total } ],
 *     narration: string,
 *   }
 *
 * Real endpoints:
 *   AR buckets + totals : GET /api/reports/overview-analytics?months=6
 *                         → { receivableAging: { current, "1-30", "31-60",
 *                             "61-90", "90+" }, monthlyTrend: [...] }
 *   AR invoice list     : GET /api/invoices?status=SENT (plus other
 *                         unpaid statuses) — used to populate the rows
 *                         array and compute per-invoice bucket / counts /
 *                         daysOverdue. Bucket totals come from the
 *                         overview-analytics response.
 *   AP aging            : GET /api/bills/ap-aging
 *                         → { current, days1to30, days31to60, days61to90,
 *                             days90plus, total, details[] }
 *
 * The live response does NOT include an Aminah narration string. We compute
 * a minimal narration client-side from the bucket totals rather than invent
 * a backend call.
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

/** Bucket an invoice by days-overdue into the mock's 5 bucket keys. */
function bucketFromDaysOverdue(daysOverdue) {
  if (daysOverdue <= 0) return 'current';
  if (daysOverdue <= 30) return 'b1_30';
  if (daysOverdue <= 60) return 'b31_60';
  if (daysOverdue <= 90) return 'b61_90';
  return 'b90_plus';
}

/** Convert a Prisma InvoiceStatus to the mock's status enum. */
function statusFromApi(apiStatus, outstanding) {
  const s = String(apiStatus || '').toUpperCase();
  if (s === 'VOID' || s === 'VOIDED') return 'written_off';
  if (s === 'PAID' || outstanding <= 0) return 'paid';
  if (s === 'PARTIALLY_PAID' || s === 'PARTIAL') return 'partial';
  if (s === 'DISPUTED') return 'disputed';
  return 'outstanding';
}

/** Empty totals / counts skeleton matching the mock shape. */
function emptyBuckets() {
  return { current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0, total: 0 };
}

/** Compose a minimal client-side narration from bucket totals. */
function narrationFrom(totals, counts, type) {
  const over90 = Math.round(totals.b90_plus);
  const over90Count = counts.b90_plus;
  if (type === 'AR') {
    if (over90Count > 0) {
      return `Receivables aging: ${over90Count} invoice${over90Count === 1 ? '' : 's'} over 90 days totaling ${over90.toLocaleString()} KWD.`;
    }
    return `Receivables aging: ${counts.total} open invoice${counts.total === 1 ? '' : 's'} totaling ${Math.round(totals.total).toLocaleString()} KWD.`;
  }
  // AP
  if (over90Count > 0) {
    return `Payables aging: ${over90Count} bill${over90Count === 1 ? '' : 's'} over 90 days totaling ${over90.toLocaleString()} KWD.`;
  }
  return `Payables aging: ${counts.total} open bill${counts.total === 1 ? '' : 's'} totaling ${Math.round(totals.total).toLocaleString()} KWD.`;
}

/**
 * Derive a per-invoice bucket/daysOverdue from dueDate and outstanding.
 * Used by the AR adapter which has to walk the full invoice list client-side
 * (the overview-analytics endpoint returns bucket totals only, not rows).
 */
function _computeDaysOverdue(dueDateStr) {
  if (!dueDateStr) return 0;
  const due = new Date(dueDateStr);
  if (Number.isNaN(due.getTime())) return 0;
  const ms = Date.now() - due.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/** Map a raw invoice row to the mock's invoice shape. */
function adaptInvoiceRow(apiInv) {
  const totalAmount = num(apiInv.totalAmount ?? apiInv.total ?? apiInv.amount);
  const amountPaid = num(apiInv.amountPaid ?? apiInv.paid ?? 0);
  const outstanding = Math.max(0, totalAmount - amountPaid);
  const daysOverdue = Math.max(0, _computeDaysOverdue(apiInv.dueDate));
  const bucket = bucketFromDaysOverdue(daysOverdue);
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
    dueDate: apiInv.dueDate || null,
    daysOverdue,
    amount: totalAmount,
    outstanding,
    status: statusFromApi(apiInv.status, outstanding),
    bucket,
    partialPayments: [],
    communicationHistory: [],
    lineItems: Array.isArray(apiInv.lines)
      ? apiInv.lines.map((l) => ({
          description: l.description || '',
          qty: num(l.quantity),
          unitPrice: num(l.unitPrice),
          total: num(l.quantity) * num(l.unitPrice),
        }))
      : [],
    raw: apiInv,
  };
}

/** Map the AP ap-aging details row to the mock invoice shape. */
function adaptBillDetailRow(detail) {
  const totalAmount = num(detail.totalAmount);
  const amountPaid = num(detail.amountPaid);
  const outstanding = num(detail.outstanding);
  const daysOverdue = Math.max(0, num(detail.daysOverdue));
  const bucket = bucketFromDaysOverdue(daysOverdue);
  const vendorName =
    detail.vendor?.nameEn || detail.vendor?.name || detail.vendorName || '';
  return {
    id: String(detail.billId || ''),
    type: 'AP',
    partyId: detail.vendor?.id || detail.vendorId || '',
    partyName: vendorName,
    invoiceNumber: detail.billNumber || '',
    invoiceDate: detail.issueDate || null,
    dueDate: detail.dueDate || null,
    daysOverdue,
    amount: totalAmount,
    outstanding,
    status: outstanding <= 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'outstanding',
    bucket,
    partialPayments: [],
    communicationHistory: [],
    lineItems: [],
    raw: detail,
  };
}

/** Build the trend[] array (6 months) from monthlyTrend in overview-analytics. */
function adaptTrendFromOverview(monthlyTrend) {
  if (!Array.isArray(monthlyTrend) || monthlyTrend.length === 0) return [];
  // overview-analytics monthlyTrend has {month, revenue, expenses, ...}
  // It doesn't break down by aging bucket, so we can't reconstruct the
  // per-bucket stacked chart. We return an empty trend and let the UI
  // render an empty chart rather than invent data.
  return monthlyTrend.slice(-6).map((m) => ({
    month: typeof m.month === 'string' ? m.month.slice(0, 3) : '',
    current: 0,
    b1_30: 0,
    b31_60: 0,
    b61_90: 0,
    b90_plus: 0,
    total: 0,
  }));
}

// ── AR aging ──────────────────────────────────────────────────────
/**
 * Build AR aging from /api/reports/overview-analytics (bucket totals)
 * plus /api/invoices list (per-invoice rows). Rows are bucketed
 * client-side so the row-level view isn't limited by whatever subset
 * of statuses overview-analytics counted.
 */
export async function getArAgingReport() {
  const [overviewRes, invoicesRes] = await Promise.all([
    client.get('/api/reports/overview-analytics', { params: { months: 6 } }),
    // Pull a generous slice of unpaid-ish invoices. The mockEngine
    // returns every unpaid invoice too; we follow that lead.
    client.get('/api/invoices', { params: { limit: 200 } }),
  ]);
  const overview = unwrap(overviewRes) || {};
  const invoicesRaw = unwrap(invoicesRes);
  const invoiceArr = Array.isArray(invoicesRaw)
    ? invoicesRaw
    : invoicesRaw?.invoices || invoicesRaw?.items || [];

  const invoices = invoiceArr
    .map(adaptInvoiceRow)
    // Exclude already-paid from the aging list; aging is an open-items view.
    .filter((inv) => inv.status !== 'paid' && inv.status !== 'written_off');

  // Totals from overview-analytics.receivableAging take precedence over
  // the client-side walk so the hero numbers match whatever the backend
  // considered unpaid. Counts are derived client-side from the walked
  // invoice list (the endpoint doesn't expose per-bucket counts).
  const ra = overview.receivableAging || {};
  const totals = {
    current: num(ra.current),
    b1_30: num(ra['1-30']),
    b31_60: num(ra['31-60']),
    b61_90: num(ra['61-90']),
    b90_plus: num(ra['90+']),
    total: 0,
  };
  totals.total =
    totals.current + totals.b1_30 + totals.b31_60 + totals.b61_90 + totals.b90_plus;

  const counts = emptyBuckets();
  for (const inv of invoices) {
    counts[inv.bucket] = (counts[inv.bucket] || 0) + 1;
    counts.total += 1;
  }

  // If overview-analytics returned zero totals but we have invoices,
  // fall back to the client-side sum so the hero strip isn't blank.
  if (totals.total === 0 && invoices.length > 0) {
    for (const inv of invoices) {
      totals[inv.bucket] = (totals[inv.bucket] || 0) + inv.outstanding;
      totals.total += inv.outstanding;
    }
  }

  return {
    type: 'AR',
    asOfDate: new Date().toISOString(),
    totals,
    counts,
    invoices,
    dso: null,
    dpo: null,
    trend: adaptTrendFromOverview(overview.monthlyTrend),
    narration: narrationFrom(totals, counts, 'AR'),
  };
}

// ── AP aging ──────────────────────────────────────────────────────
export async function getApAgingReport() {
  const r = await client.get('/api/bills/ap-aging');
  const data = unwrap(r) || {};
  const detailsArr = Array.isArray(data.details) ? data.details : [];

  const invoices = detailsArr
    .map(adaptBillDetailRow)
    .filter((inv) => inv.outstanding > 0);

  const totals = {
    current: num(data.current),
    b1_30: num(data.days1to30),
    b31_60: num(data.days31to60),
    b61_90: num(data.days61to90),
    b90_plus: num(data.days90plus),
    total: num(data.total),
  };

  const counts = emptyBuckets();
  for (const inv of invoices) {
    counts[inv.bucket] = (counts[inv.bucket] || 0) + 1;
    counts.total += 1;
  }

  return {
    type: 'AP',
    asOfDate: new Date().toISOString(),
    totals,
    counts,
    invoices,
    dso: null,
    dpo: null,
    trend: [],
    narration: narrationFrom(totals, counts, 'AP'),
  };
}

/** Dispatch on type. Matches the mockEngine signature `getAgingReport(type)`. */
export async function getAgingReport(type = 'AR') {
  if (type === 'AP') return getApAgingReport();
  return getArAgingReport();
}
