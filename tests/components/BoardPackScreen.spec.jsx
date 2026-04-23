/**
 * BoardPackScreen — AUDIT-ACC-056 (2026-04-23).
 *
 * Covers:
 *   1. Populated pack renders header, fiscal-year meta, four sections
 *      (current reports / prior reports / YoY comparisons / disclosure
 *      summaries).
 *   2. Empty pack renders the empty-state panel and suppresses section
 *      tables.
 *   3. Warning banner renders only when the backend envelope has
 *      warnings.
 *   4. Year picker re-invokes getBoardPack with the selected fiscal
 *      year.
 *   5. Role gating: CFO, Senior, Junior each land on the role-gate
 *      panel with zero data fetched. Owner renders the screen.
 *   6. Error envelope surfaces the translated load-failed banner.
 *   7. i18n parity: EN+AR boardPack namespaces have identical key sets.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
  waitFor,
} from '@testing-library/react';
import React from 'react';

import i18n from '../../src/i18n';
import enBP from '../../src/i18n/locales/en/boardPack.json';
import arBP from '../../src/i18n/locales/ar/boardPack.json';

// ── Engine boundary stub ──────────────────────────────────────────
const getBoardPackSpy = vi.fn();

vi.mock('../../src/engine', () => ({
  __esModule: true,
  getBoardPack: (...args) => getBoardPackSpy(...args),
}));

import BoardPackScreen from '../../src/screens/owner/BoardPackScreen';

async function setLang(lang) {
  await act(async () => {
    await i18n.changeLanguage(lang);
  });
}

// ── Fixtures ──────────────────────────────────────────────────────

function makePack(overrides = {}) {
  const fy = 2025;
  const prior = 2024;
  return {
    fiscalYear: fy,
    priorFiscalYear: prior,
    generatedAt: '2026-03-20T09:15:00.000Z',
    currentReportVersions: [
      {
        reportType: 'BALANCE_SHEET',
        reportKey: 'BS_2025',
        version: 3,
        publishedAt: '2026-03-18T09:15:00.000Z',
        publishedBy: 'owner@haseeb.kw',
        notes: null,
        asOfDate: '2025-12-31',
        periodFrom: null,
        periodTo: null,
      },
      {
        reportType: 'INCOME_STATEMENT',
        reportKey: 'IS_2025',
        version: 2,
        publishedAt: '2026-03-18T09:15:00.000Z',
        publishedBy: 'owner@haseeb.kw',
        notes: null,
        asOfDate: null,
        periodFrom: '2025-01-01',
        periodTo: '2025-12-31',
      },
    ],
    priorReportVersions: [
      {
        reportType: 'BALANCE_SHEET',
        reportKey: 'BS_2024',
        version: 2,
        publishedAt: '2025-03-10T09:15:00.000Z',
        publishedBy: 'owner@haseeb.kw',
        notes: null,
        asOfDate: '2024-12-31',
        periodFrom: null,
        periodTo: null,
      },
    ],
    yoyComparisons: [
      {
        reportType: 'BALANCE_SHEET',
        reportKey: 'BS_2025',
        metrics: [
          {
            metricName: 'totalAssets',
            priorValue: '8125400.000',
            currentValue: '9340200.000',
            deltaAbsolute: '1214800.000',
            deltaPercent: '14.95',
          },
        ],
        priorVersion: null,
        currentVersion: null,
      },
    ],
    disclosureSummaries: [
      {
        runId: 'drun-2025-en',
        fiscalYear: fy,
        language: 'en',
        approvedAt: '2026-03-20T09:15:00.000Z',
        materialNoteCount: 8,
      },
    ],
    warnings: [],
    ...overrides,
  };
}

function emptyPack(overrides = {}) {
  return {
    fiscalYear: 2025,
    priorFiscalYear: 2024,
    generatedAt: '2026-03-20T09:15:00.000Z',
    currentReportVersions: [],
    priorReportVersions: [],
    yoyComparisons: [],
    disclosureSummaries: [],
    warnings: [],
    ...overrides,
  };
}

// ── Role-gate tests ───────────────────────────────────────────────

describe('BoardPackScreen — role gating', () => {
  beforeEach(async () => {
    getBoardPackSpy.mockReset();
    await setLang('en');
  });
  afterEach(() => cleanup());

  it('Junior sees role-gate panel and triggers zero fetches', async () => {
    render(<BoardPackScreen role="Junior" />);
    expect(
      await screen.findByTestId('boardpack-role-gate'),
    ).toBeInTheDocument();
    expect(getBoardPackSpy).not.toHaveBeenCalled();
  });

  it('CFO sees role-gate panel and triggers zero fetches', async () => {
    render(<BoardPackScreen role="CFO" />);
    expect(
      await screen.findByTestId('boardpack-role-gate'),
    ).toBeInTheDocument();
    expect(getBoardPackSpy).not.toHaveBeenCalled();
  });

  it('Senior sees role-gate panel and triggers zero fetches', async () => {
    render(<BoardPackScreen role="Senior" />);
    expect(
      await screen.findByTestId('boardpack-role-gate'),
    ).toBeInTheDocument();
    expect(getBoardPackSpy).not.toHaveBeenCalled();
  });

  it('Owner renders the full screen and fetches on mount', async () => {
    getBoardPackSpy.mockResolvedValue(makePack());
    render(<BoardPackScreen role="Owner" />);
    await waitFor(() => {
      expect(screen.getByTestId('boardpack-screen')).toBeInTheDocument();
    });
    expect(getBoardPackSpy).toHaveBeenCalledTimes(1);
    expect(getBoardPackSpy).toHaveBeenCalledWith(
      expect.objectContaining({ fiscalYear: expect.any(Number) }),
    );
  });
});

// ── Populated content ─────────────────────────────────────────────

describe('BoardPackScreen — populated content', () => {
  beforeEach(async () => {
    getBoardPackSpy.mockReset();
    await setLang('en');
  });
  afterEach(() => cleanup());

  it('renders the four sections for a populated pack', async () => {
    getBoardPackSpy.mockResolvedValue(makePack());
    render(<BoardPackScreen role="Owner" />);
    await waitFor(() => {
      expect(screen.getByTestId('boardpack-section-current')).toBeInTheDocument();
    });
    expect(screen.getByTestId('boardpack-section-prior')).toBeInTheDocument();
    expect(screen.getByTestId('boardpack-section-yoy')).toBeInTheDocument();
    expect(
      screen.getByTestId('boardpack-section-disclosures'),
    ).toBeInTheDocument();
  });

  it('renders current + prior report version rows with correct testids', async () => {
    getBoardPackSpy.mockResolvedValue(makePack());
    render(<BoardPackScreen role="Owner" />);
    await waitFor(() => {
      expect(
        screen.getByTestId('boardpack-report-row-BALANCE_SHEET-BS_2025'),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByTestId('boardpack-report-row-INCOME_STATEMENT-IS_2025'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('boardpack-report-row-BALANCE_SHEET-BS_2024'),
    ).toBeInTheDocument();
  });

  it('renders YoY metric rows with correct testids', async () => {
    getBoardPackSpy.mockResolvedValue(makePack());
    render(<BoardPackScreen role="Owner" />);
    await waitFor(() => {
      expect(
        screen.getByTestId('boardpack-yoy-BALANCE_SHEET-BS_2025'),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByTestId(
        'boardpack-yoy-metric-BALANCE_SHEET-BS_2025-totalAssets',
      ),
    ).toBeInTheDocument();
  });

  it('renders disclosure summary rows', async () => {
    getBoardPackSpy.mockResolvedValue(makePack());
    render(<BoardPackScreen role="Owner" />);
    await waitFor(() => {
      expect(
        screen.getByTestId('boardpack-disclosure-drun-2025-en'),
      ).toBeInTheDocument();
    });
  });

  it('renders the meta strip with fiscal year + prior year + generatedAt', async () => {
    getBoardPackSpy.mockResolvedValue(makePack());
    render(<BoardPackScreen role="Owner" />);
    await waitFor(() => {
      expect(screen.getByTestId('boardpack-meta')).toBeInTheDocument();
    });
    const meta = screen.getByTestId('boardpack-meta');
    expect(meta).toHaveTextContent('2025');
    expect(meta).toHaveTextContent('2024');
    expect(meta).toHaveTextContent('2026-03-20');
  });
});

// ── Warnings ──────────────────────────────────────────────────────

describe('BoardPackScreen — warnings', () => {
  beforeEach(async () => {
    getBoardPackSpy.mockReset();
    await setLang('en');
  });
  afterEach(() => cleanup());

  it('renders warning banner when warnings[] is non-empty', async () => {
    getBoardPackSpy.mockResolvedValue(
      makePack({ warnings: ['stale data', 'missing disclosure run'] }),
    );
    render(<BoardPackScreen role="Owner" />);
    await waitFor(() => {
      expect(screen.getByTestId('boardpack-warnings')).toBeInTheDocument();
    });
    expect(
      screen.getByTestId('boardpack-warnings'),
    ).toHaveTextContent('stale data');
    expect(
      screen.getByTestId('boardpack-warnings'),
    ).toHaveTextContent('missing disclosure run');
  });

  it('does not render warning banner when warnings[] is empty', async () => {
    getBoardPackSpy.mockResolvedValue(makePack({ warnings: [] }));
    render(<BoardPackScreen role="Owner" />);
    await waitFor(() => {
      expect(screen.getByTestId('boardpack-screen')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('boardpack-warnings')).not.toBeInTheDocument();
  });
});

// ── Empty pack ────────────────────────────────────────────────────

describe('BoardPackScreen — empty pack', () => {
  beforeEach(async () => {
    getBoardPackSpy.mockReset();
    await setLang('en');
  });
  afterEach(() => cleanup());

  it('shows empty state and suppresses section tables when all arrays are empty', async () => {
    getBoardPackSpy.mockResolvedValue(emptyPack());
    render(<BoardPackScreen role="Owner" />);
    await waitFor(() => {
      expect(screen.getByTestId('boardpack-empty')).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId('boardpack-section-current'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('boardpack-section-yoy'),
    ).not.toBeInTheDocument();
  });
});

// ── Year picker ───────────────────────────────────────────────────

describe('BoardPackScreen — year picker', () => {
  beforeEach(async () => {
    getBoardPackSpy.mockReset();
    await setLang('en');
  });
  afterEach(() => cleanup());

  it('changes fiscalYear and re-invokes getBoardPack', async () => {
    getBoardPackSpy.mockResolvedValue(makePack());
    render(<BoardPackScreen role="Owner" />);
    await waitFor(() => {
      expect(screen.getByTestId('boardpack-year-select')).toBeInTheDocument();
    });
    const initialCalls = getBoardPackSpy.mock.calls.length;
    const select = screen.getByTestId('boardpack-year-select');
    const newYear = parseInt(select.value, 10) - 1;
    fireEvent.change(select, { target: { value: String(newYear) } });
    await waitFor(() => {
      expect(getBoardPackSpy.mock.calls.length).toBeGreaterThan(initialCalls);
    });
    const latest =
      getBoardPackSpy.mock.calls[getBoardPackSpy.mock.calls.length - 1];
    expect(latest[0]).toEqual(
      expect.objectContaining({ fiscalYear: newYear }),
    );
  });

  it('reload button triggers another fetch with the current fiscal year', async () => {
    getBoardPackSpy.mockResolvedValue(makePack());
    render(<BoardPackScreen role="Owner" />);
    await waitFor(() => {
      expect(screen.getByTestId('boardpack-reload')).toBeInTheDocument();
    });
    const initialCalls = getBoardPackSpy.mock.calls.length;
    fireEvent.click(screen.getByTestId('boardpack-reload'));
    await waitFor(() => {
      expect(getBoardPackSpy.mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });
});

// ── Error path ────────────────────────────────────────────────────

describe('BoardPackScreen — error path', () => {
  beforeEach(async () => {
    getBoardPackSpy.mockReset();
    await setLang('en');
  });
  afterEach(() => cleanup());

  it('surfaces the load-failed banner when getBoardPack rejects', async () => {
    getBoardPackSpy.mockRejectedValue(new Error('backend 500'));
    render(<BoardPackScreen role="Owner" />);
    await waitFor(() => {
      expect(screen.getByTestId('boardpack-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('boardpack-error')).toHaveTextContent(
      'backend 500',
    );
  });
});

// ── i18n parity ───────────────────────────────────────────────────

describe('BoardPackScreen — i18n parity', () => {
  function keyTree(obj, prefix = '') {
    const out = [];
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        out.push(...keyTree(v, path));
      } else {
        out.push(path);
      }
    }
    return out;
  }

  it('EN + AR boardPack namespaces carry identical key sets', () => {
    const enKeys = keyTree(enBP).sort();
    const arKeys = keyTree(arBP).sort();
    expect(arKeys).toEqual(enKeys);
  });
});
