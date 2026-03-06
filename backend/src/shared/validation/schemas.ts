import { z } from 'zod';

export const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  notifyEmail: z.string().email(),
});

export const updateOrgSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  notifyEmail: z.string().email().optional(),
});

export const createMonitorSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url().startsWith('https://', 'URL must use HTTPS'),
  method: z.enum(['GET', 'HEAD', 'POST']).default('GET'),
  expectedStatus: z.number().int().min(100).max(599).default(200),
  timeoutMs: z.number().int().min(1000).max(30000).default(10000),
});

export const updateMonitorSchema = createMonitorSchema.partial().extend({
  enabled: z.boolean().optional(),
});

export const createIncidentSchema = z.object({
  title: z.string().min(1).max(200),
  status: z.enum(['investigating', 'identified', 'monitoring', 'resolved']),
  impact: z.enum(['none', 'minor', 'major', 'critical']),
  monitorId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
});

export const updateIncidentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: z.enum(['investigating', 'identified', 'monitoring', 'resolved']).optional(),
  impact: z.enum(['none', 'minor', 'major', 'critical']).optional(),
  message: z.string().min(1).max(2000),
});

export const addIncidentUpdateSchema = z.object({
  message: z.string().min(1).max(2000),
  status: z.enum(['investigating', 'identified', 'monitoring', 'resolved']),
});
