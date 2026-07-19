import { z } from 'zod';

const EvidenceUrls = z.array(z.string().min(1).max(2000)).min(1).max(8);

const FieldProposal = z.object({
  value: z.union([z.string(), z.number(), z.array(z.string())]).nullable().optional(),
  source_url: z.string().min(1).max(2000).optional(),
  evidence_urls: EvidenceUrls.optional(),
  source_urls: z.array(z.string().min(1).max(2000)).optional(),
  source_title: z.string().max(300).optional().nullable(),
  evidence_excerpt: z.string().max(1200).optional().nullable(),
  identity_anchor: z.string().max(300).optional().nullable(),
  sentence_evidence: z.array(z.object({
    sentence: z.string().min(1).max(800),
    evidence_urls: EvidenceUrls,
  })).max(20).optional(),
}).strict();

const FieldValue = z.union([FieldProposal, z.string(), z.array(z.string()), z.null()]);

export const GeminiPeopleResearchSchema = z.object({
  identity_status: z.enum(['matched', 'needs_review', 'no_match']),
  identity_confidence: z.number().min(0).max(1),
  identity_reasons: z.array(z.string().min(1).max(400)).max(20),
  identity_anchors: z.array(z.string().min(1).max(400)).max(20).default([]),
  matched_credits: z.array(z.string().min(1).max(300)).max(30).default([]),
  proposed_name: z.string().max(200).optional().nullable(),
  candidate_fields: z.record(z.string(), FieldValue).default({}),
  conflicts: z.array(z.object({
    field: z.string().max(80),
    values: z.array(z.string()).max(8),
    note: z.string().max(500).optional().nullable(),
  })).default([]),
  source_urls: z.array(z.string().min(1).max(2000)).max(40).default([]),
  no_match_reason: z.string().max(800).optional().nullable(),
}).strict();

export type GeminiPeopleResearchPayload = z.infer<typeof GeminiPeopleResearchSchema>;
