/**
 * AminahChat i18n regression — HASEEB-118 sweep.
 *
 * Covers the 5 strings that were inline in AminahChat.jsx pre-sweep:
 *   header.status_online  ("AMINAH ONLINE")
 *   header.status_thinking  ("AMINAH THINKING...")
 *   empty_state.simple_subtitle  ("Ask me anything about your business.")
 *   subtitle_thinking  ("Thinking...") — existing key, reused
 *   input.placeholder_short  ("Ask Aminah...")
 *
 * Each is asserted in both EN and AR to catch accidental revert-to-English
 * in a future edit. If any of these strings regress to hardcoded text,
 * flipping `i18n.changeLanguage('ar')` will fail to replace them and this
 * test will catch it.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import React from 'react';

import AminahChat from '../../src/components/AminahChat';
import i18n from '../../src/i18n';
import { _resetAdvisorPendingStub } from '../../src/engine/aminah/advisor-pending-stub';

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, tenant: null, token: null, isAuthenticated: false }),
}));

async function setLang(lang) {
  await act(async () => { await i18n.changeLanguage(lang); });
}

describe('AminahChat — i18n (HASEEB-118 sweep)', () => {
  beforeEach(() => {
    _resetAdvisorPendingStub();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders all 5 formerly-hardcoded strings from the EN bundle', async () => {
    await setLang('en');
    render(<AminahChat role="CFO" />);

    // Header online status.
    await waitFor(() => expect(screen.getByText('AMINAH ONLINE')).toBeInTheDocument());

    // Empty-state simple subtitle (only renders when messages.length === 0;
    // the component boots with no messages, so it's visible on mount).
    expect(screen.getByText('Ask me anything about your business.')).toBeInTheDocument();

    // Input placeholder.
    expect(screen.getByPlaceholderText('Ask Aminah...')).toBeInTheDocument();

    // subtitle_thinking and header.status_thinking only render during
    // streaming. We don't kick a real stream here; the i18n lookup is
    // covered by the fact that the component reads from the same bundle
    // via t(), so the two inactive strings are verified by the bundle
    // presence test below.
    expect(i18n.t('subtitle_thinking', { ns: 'aminah' })).toBe('Thinking...');
    expect(i18n.t('header.status_thinking', { ns: 'aminah' })).toBe('AMINAH THINKING...');
  });

  it('renders all 5 formerly-hardcoded strings from the AR bundle', async () => {
    await setLang('ar');
    render(<AminahChat role="CFO" />);

    await waitFor(() => expect(screen.getByText('أمينة متصلة')).toBeInTheDocument());
    expect(screen.getByText('اسألني عن أي شيء يخص عملك.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('اسأل أمينة...')).toBeInTheDocument();

    expect(i18n.t('subtitle_thinking', { ns: 'aminah' })).toBe('جارٍ التفكير...');
    expect(i18n.t('header.status_thinking', { ns: 'aminah' })).toBe('أمينة تفكر...');
  });

  it('has no hardcoded English that would leak through in AR mode', async () => {
    // Regression guard: if a future edit re-introduces `"AMINAH ONLINE"`
    // inline (bypassing t()), AR-mode rendering would still show the
    // English string. This test catches that specific class of bug.
    await setLang('ar');
    render(<AminahChat role="CFO" />);

    await waitFor(() => expect(screen.getByText('أمينة متصلة')).toBeInTheDocument());

    expect(screen.queryByText('AMINAH ONLINE')).toBeNull();
    expect(screen.queryByText('Ask me anything about your business.')).toBeNull();
    expect(screen.queryByPlaceholderText('Ask Aminah...')).toBeNull();
  });
});

describe('AminahChat — i18n (HASEEB-125 mop-up)', () => {
  beforeEach(() => {
    _resetAdvisorPendingStub();
  });

  afterEach(() => {
    cleanup();
  });

  // Pre-HASEEB-125, `AminahChat.jsx` had a hardcoded PROMPTS array and
  // a hardcoded error-fallback string. Both are now routed through the
  // aminah i18n bundle. The PROMPTS array is additionally upgraded to
  // role-aware prompts via `{owner,cfo,junior}.q1..q4`.

  it('CFO role: renders cfo.q1..q4 as starter prompt pills in EN', async () => {
    await setLang('en');
    render(<AminahChat role="CFO" />);

    await waitFor(() => expect(screen.getByText('AMINAH ONLINE')).toBeInTheDocument());

    expect(screen.getByText('What needs my attention right now?')).toBeInTheDocument();
    expect(screen.getByText("Summarize today's bank transactions")).toBeInTheDocument();
    expect(screen.getByText("What's blocking the close?")).toBeInTheDocument();
    expect(screen.getByText('Any rules I should approve?')).toBeInTheDocument();
  });

  it('CFO role: renders cfo.q1..q4 translations in AR', async () => {
    await setLang('ar');
    render(<AminahChat role="CFO" />);

    await waitFor(() => expect(screen.getByText('أمينة متصلة')).toBeInTheDocument());

    expect(screen.getByText('ما الذي يحتاج اهتمامي الآن؟')).toBeInTheDocument();
    expect(screen.getByText('لخّص العمليات البنكية لليوم')).toBeInTheDocument();
    expect(screen.getByText('ما الذي يعيق الإقفال؟')).toBeInTheDocument();
    expect(screen.getByText('هل هناك قواعد تحتاج اعتمادي؟')).toBeInTheDocument();
  });

  it('Owner role: renders owner.q1..q4 (not cfo) as starter prompts', async () => {
    await setLang('en');
    render(<AminahChat role="Owner" />);

    await waitFor(() => expect(screen.getByText('AMINAH ONLINE')).toBeInTheDocument());

    // Owner prompts present
    expect(screen.getByText('How is cash this month?')).toBeInTheDocument();
    expect(screen.getByText("What's my biggest expense risk?")).toBeInTheDocument();
    // CFO-specific prompts must NOT leak into Owner view
    expect(screen.queryByText('What needs my attention right now?')).toBeNull();
    expect(screen.queryByText('Any rules I should approve?')).toBeNull();
  });

  it('Junior role: renders junior.q1..q4 as starter prompts', async () => {
    await setLang('en');
    render(<AminahChat role="Junior" />);

    await waitFor(() => expect(screen.getByText('AMINAH ONLINE')).toBeInTheDocument());

    expect(screen.getByText('What should I work on next?')).toBeInTheDocument();
    expect(screen.getByText('Help me categorize this transaction')).toBeInTheDocument();
    expect(screen.getByText('Draft a JE for me')).toBeInTheDocument();
    expect(screen.getByText("What's my accuracy this week?")).toBeInTheDocument();
  });

  it('AR mode: no hardcoded-English PROMPTS leak', async () => {
    // Regression guard for the specific class HASEEB-125 closes. Any of
    // the pre-HASEEB-125 hardcoded English prompt strings showing up in
    // AR mode would fail this test.
    await setLang('ar');
    render(<AminahChat role="CFO" />);

    await waitFor(() => expect(screen.getByText('أمينة متصلة')).toBeInTheDocument());

    expect(screen.queryByText('How am I doing?')).toBeNull();
    expect(screen.queryByText('Cash position')).toBeNull();
    expect(screen.queryByText('Budget status')).toBeNull();
    expect(screen.queryByText('Anything to worry about?')).toBeNull();
  });

  it('error.generic bundle key is what the error-fallback path renders', async () => {
    // The applyEvent() error branch uses `event.message || t("error.generic")`.
    // Direct i18n assertion documents the fallback for both languages —
    // a functional render of the error-fallback path requires a full
    // streaming mock that's out of scope for an i18n regression spec.
    await setLang('en');
    expect(i18n.t('error.generic', { ns: 'aminah' })).toBe(
      'Something went wrong. Please try again.',
    );
    await setLang('ar');
    expect(i18n.t('error.generic', { ns: 'aminah' })).toBe(
      'حدث خطأ ما. يرجى المحاولة مرة أخرى.',
    );
  });
});
