/**
 * Chart of accounts API module.
 *
 * Maps between the Corporate API's richer account shape and the flat
 * object shape the existing Setup screen expects from mockEngine's
 * `getSetupChartOfAccounts` (see mockEngine.js:6469).
 *
 * Mock shape:
 *   { code, name, type, subtype, balance, status, parent }
 *   where `type` is one of "Assets" | "Liabilities" | "Equity" | "Revenue" | "Expenses"
 *
 * API shape (prisma/tenant Account):
 *   { id, code, nameEn, nameAr, subType, parentCode, normalBalance,
 *     currency, description, isActive }
 *
 * We derive `type` from the leading digit of `code` to match the convention
 * baked into the mock data (1xxx=Assets, 2xxx=Liab, 3xxx=Equity, 4xxx=Rev,
 * 5xxx/6xxx=Expenses). This also matches the Haseeb CoA seed conventions.
 */
import client from './client';

function unwrap(response) {
  if (response && response.data && typeof response.data === 'object') {
    if ('data' in response.data) return response.data.data;
    return response.data;
  }
  return response?.data;
}

function typeFromCode(code) {
  const first = (code || '').toString()[0];
  switch (first) {
    case '1':
      return 'Assets';
    case '2':
      return 'Liabilities';
    case '3':
      return 'Equity';
    case '4':
      return 'Revenue';
    case '5':
    case '6':
    case '7':
    case '8':
      return 'Expenses';
    default:
      return 'Other';
  }
}

function adaptAccount(account) {
  if (!account) return null;
  return {
    code: account.code || account.accountCode || '',
    name: account.nameEn || account.name || account.accountName || '',
    nameAr: account.nameAr || '',
    type: typeFromCode(account.code),
    subtype: account.subType || account.subtype || '',
    balance: Number(account.balance || account.currentBalance || 0),
    status: account.isActive === false ? 'inactive' : 'active',
    parent: account.parentCode || account.parent || null,
    description: account.description || '',
    raw: account,
  };
}

export async function getAccountsFlat() {
  const r = await client.get('/api/accounts/flat');
  const data = unwrap(r);
  const arr = Array.isArray(data) ? data : data?.accounts || [];
  return arr.map(adaptAccount);
}

export async function getAccountsTree() {
  const r = await client.get('/api/accounts/tree');
  return unwrap(r);
}

/**
 * Drop-in replacement for mockEngine.getSetupChartOfAccounts().
 * Returns a flat array shape-compatible with the existing Setup UI.
 */
export async function getSetupChartOfAccounts() {
  // Prefer /api/accounts (paginated full list) which should return every
  // account including parents and inactive rows, not just postables.
  try {
    const r = await client.get('/api/accounts', { params: { limit: 500 } });
    const data = unwrap(r);
    const arr = Array.isArray(data)
      ? data
      : data?.accounts || data?.items || [];
    if (arr.length) return arr.map(adaptAccount);
  } catch {
    // fall through
  }
  // Fallback to /api/accounts/flat which is postable-only.
  return getAccountsFlat();
}
