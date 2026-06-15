import { z } from 'zod';

export const CategoryEnum = z.enum([
  'account_access',
  'technical_issue',
  'billing_question',
  'feature_request',
  'bug_report',
  'other',
]);

export const PriorityEnum = z.enum(['urgent', 'high', 'medium', 'low']);

export const StatusEnum = z.enum([
  'new',
  'in_progress',
  'waiting_customer',
  'resolved',
  'closed',
]);

export const SourceEnum = z.enum(['web_form', 'email', 'api', 'chat', 'phone']);

export const DeviceEnum = z.enum(['desktop', 'mobile', 'tablet']);

export const ClassificationSchema = z.object({
  category: CategoryEnum,
  priority: PriorityEnum,
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  keywords: z.array(z.string()),
  classified_at: z.string(),
});

export const MetadataSchema = z.object({
  source: SourceEnum,
  browser: z.string().min(1),
  device_type: DeviceEnum,
});

export const CreateTicketInputSchema = z.object({
  customer_id: z.string().min(1),
  customer_email: z.string().email(),
  customer_name: z.string().min(1),
  subject: z.string().min(1).max(200),
  description: z.string().min(10).max(2000),
  category: CategoryEnum.default('other'),
  priority: PriorityEnum.default('medium'),
  status: StatusEnum.default('new'),
  assigned_to: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
  metadata: MetadataSchema,
});

export const UpdateTicketInputSchema = CreateTicketInputSchema.partial();

export const TicketSchema = z.object({
  id: z.string(),
  customer_id: z.string(),
  customer_email: z.string().email(),
  customer_name: z.string(),
  subject: z.string(),
  description: z.string(),
  category: CategoryEnum,
  priority: PriorityEnum,
  status: StatusEnum,
  created_at: z.string(),
  updated_at: z.string(),
  resolved_at: z.string().nullable(),
  assigned_to: z.string().nullable(),
  tags: z.array(z.string()),
  metadata: MetadataSchema,
  last_classification: ClassificationSchema.nullable(),
});

export type Category = z.infer<typeof CategoryEnum>;
export type Priority = z.infer<typeof PriorityEnum>;
export type Status = z.infer<typeof StatusEnum>;
export type Source = z.infer<typeof SourceEnum>;
export type Device = z.infer<typeof DeviceEnum>;
export type Classification = z.infer<typeof ClassificationSchema>;
export type Ticket = z.infer<typeof TicketSchema>;
export type CreateTicketInput = z.infer<typeof CreateTicketInputSchema>;
export type UpdateTicketInput = z.infer<typeof UpdateTicketInputSchema>;