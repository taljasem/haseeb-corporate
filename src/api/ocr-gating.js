/**
 * OCR Gating API module (FN-224, Phase 4 Track A Tier 5 — 2026-04-19).
 *
 * Receipt / statement OCR extraction review surface. Upstream upload
 * pipelines (receipt, statement) record extractions here with per-
 * field confidence scores. Any extraction containing fields below
 * the threshold (default 80) is marked PENDING_REVIEW and surfaces
 * in this queue. OWNER can approve/reject; OWNER + ACCOUNTANT can
 * correct individual field values.
 *
 *   POST   /api/ocr-extractions               — record (OWNER/ACCT)
 *                                                typically called by
 *                                                upload pipeline
 *   PATCH  /api/ocr-extractions/fields/:id/correct  — correct one
 *                                                     field (OWNER/ACCT)
 *   POST   /api/ocr-extractions/:id/approve   — approve (OWNER)
 *   POST   /api/ocr-extractions/:id/reject    — reject with note (OWNER)
 *   GET    /api/ocr-extractions               — list + filters
 *   GET    /api/ocr-extractions/:id           — read one
 *
 * Extraction DTO:
 *   {
 *     id: string
 *     documentLabel: string
 *     sourceFilePath: string
 *     engineName: string
 *     engineVersion: string
 *     overallConfidence: number                // 0..100
 *     reviewThreshold: number                  // 0..100 (default 80)
 *     status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'
 *     reviewedBy?: string | null
 *     reviewedAt?: string | null
 *     reviewNote?: string | null
 *     fields: Array<{
 *       id: string
 *       fieldKey: string
 *       fieldValue: string                     // current value
 *                                               // (corrected or original)
 *       originalValue: string                  // raw OCR value
 *       confidence: number                     // 0..100
 *       flagged: boolean                       // < reviewThreshold
 *       corrected: boolean
 *       correctedBy?: string | null
 *       correctedAt?: string | null
 *     }>
 *     createdAt: string
 *     updatedAt: string
 *   }
 *
 * Errors normalised by src/api/client.js. 403 on approve/reject means
 * non-OWNER; 403 on correct means non-OWNER-non-ACCOUNTANT.
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

export async function listOcrExtractions(filters = {}) {
  const params = {};
  if (filters.status) params.status = filters.status;
  if (filters.hasFlagged != null) params.hasFlagged = filters.hasFlagged;
  const r = await client.get('/api/ocr-extractions', { params });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export async function getOcrExtraction(id) {
  const r = await client.get(
    `/api/ocr-extractions/${encodeURIComponent(id)}`,
  );
  return unwrap(r);
}

/** Typically called by upload pipeline, not the dashboard. */
export async function recordOcrExtraction(payload) {
  const r = await client.post('/api/ocr-extractions', payload);
  return unwrap(r);
}

/**
 * PATCH /api/ocr-extractions/fields/:id/correct
 * Note: the `:id` here is the FIELD id, not the extraction id.
 */
export async function correctOcrField(fieldId, correctedValue) {
  const r = await client.patch(
    `/api/ocr-extractions/fields/${encodeURIComponent(fieldId)}/correct`,
    { correctedValue },
  );
  return unwrap(r);
}

export async function approveOcrExtraction(id, reviewNote) {
  const r = await client.post(
    `/api/ocr-extractions/${encodeURIComponent(id)}/approve`,
    reviewNote ? { reviewNote } : {},
  );
  return unwrap(r);
}

export async function rejectOcrExtraction(id, reviewNote) {
  const r = await client.post(
    `/api/ocr-extractions/${encodeURIComponent(id)}/reject`,
    { reviewNote },
  );
  return unwrap(r);
}
