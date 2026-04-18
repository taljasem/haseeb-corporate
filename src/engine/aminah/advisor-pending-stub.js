// MOCK-MODE STUB DATA — not production Aminah state. See HASEEB-046 closeout for LIVE mode.
//
// Scripted stand-in for the Corporate API /api/aminah/pending* surfaces.
// Only used when VITE_USE_MOCKS !== 'false'. In LIVE mode the engine
// router wires the advisor-pending.js module directly and this file is
// never imported.
//
// The seed set is intentionally tiny (2 items) so it matches the shape
// of a real-world Aminah queue mid-month: one actionable statutory-reserve
// nudge with a pending JE ready to confirm, one compliance-calendar
// heads-up without a JE so only Defer/Dismiss apply. Both are Al Manara
// demo data per CLAUDE.md's "no real tenant data in screenshots" rule.

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function isoDaysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function makeSeed() {
  const now = new Date().toISOString();
  return [
    {
      id: 'mock-pending-1',
      tenantId: 'al-manara-demo',
      source: 'statutory-reserve',
      subject: 'Statutory reserve transfer due March 31',
      message:
        "I computed 4,200 KWD from current retained earnings. Ready to post — confirm?",
      messageAr: 'تحويل الاحتياطي القانوني مستحق في 31 مارس',
      severity: 'warning',
      status: 'ACTIVE',
      suggestedToolCalls: undefined,
      pendingJeId: 'mock-je-1',
      actionPayload: undefined,
      displayAmountKwd: '4200.000',
      dueAt: isoDaysFromNow(3),
      deferredUntil: undefined,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'mock-pending-2',
      tenantId: 'al-manara-demo',
      source: 'compliance-calendar',
      subject: 'March PIFSS due April 15',
      message:
        "No payroll run found for March yet. Run payroll first, then I'll draft the PIFSS file.",
      messageAr: 'استحقاق التأمينات الاجتماعية لشهر مارس في 15 أبريل',
      severity: 'info',
      status: 'ACTIVE',
      suggestedToolCalls: undefined,
      pendingJeId: undefined,
      actionPayload: undefined,
      displayAmountKwd: undefined,
      dueAt: isoDaysFromNow(15),
      deferredUntil: undefined,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

// In-memory mutable list. Each page load resets it — this is MOCK mode,
// not persistence. Any test that depends on the initial state can call
// _resetAdvisorPendingStub() (exported below) to rewind.
let _items = makeSeed();

export function _resetAdvisorPendingStub() {
  _items = makeSeed();
}

export async function listAdvisorPendingMock() {
  await delay(80);
  // Filter deferred-to-future items, matching the server's behaviour.
  const now = Date.now();
  return _items
    .filter((it) => {
      if (!it.deferredUntil) return true;
      return new Date(it.deferredUntil).getTime() <= now;
    })
    .map((it) => ({ ...it }));
}

export async function deferAdvisorPendingMock(id, deferredUntil) {
  await delay(80);
  const idx = _items.findIndex((it) => it.id === id);
  if (idx < 0) {
    throw { ok: false, status: 404, code: 'CLIENT_ERROR', message: 'Pending item not found' };
  }
  _items[idx] = {
    ...(_items[idx]),
    deferredUntil,
    status: 'DEFERRED',
    updatedAt: new Date().toISOString(),
  };
  return { ...(_items[idx]) };
}

export async function dismissAdvisorPendingMock(id, reason) {
  await delay(80);
  const idx = _items.findIndex((it) => it.id === id);
  if (idx < 0) {
    throw { ok: false, status: 404, code: 'CLIENT_ERROR', message: 'Pending item not found' };
  }
  const updated = {
    ...(_items[idx]),
    status: 'DISMISSED',
    dismissReason: reason || undefined,
    updatedAt: new Date().toISOString(),
  };
  // Remove from the active list so the next listAdvisorPendingMock() call
  // reflects the dismissal.
  _items.splice(idx, 1);
  return updated;
}

export async function acknowledgeAdvisorPendingMock(id, gatewayResponseRef) {
  await delay(80);
  const idx = _items.findIndex((it) => it.id === id);
  if (idx < 0) {
    throw { ok: false, status: 404, code: 'CLIENT_ERROR', message: 'Pending item not found' };
  }
  const updated = {
    ...(_items[idx]),
    status: 'ACKNOWLEDGED',
    gatewayResponseRef: gatewayResponseRef || undefined,
    updatedAt: new Date().toISOString(),
  };
  _items.splice(idx, 1);
  return updated;
}
