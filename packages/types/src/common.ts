import { z } from 'zod';

export const idSchema = z.string().min(1).max(64);
export type Id = z.infer<typeof idSchema>;

export const emailSchema = z.string().email().max(254).toLowerCase();
export const isoDateTimeSchema = z.string().datetime({ offset: true });

export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const sortDirectionSchema = z.enum(['asc', 'desc']);
export type SortDirection = z.infer<typeof sortDirectionSchema>;

export function pageOf<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}

export const cuidSchema = z.string().cuid();
export const slugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9](-?[a-z0-9])*$/, 'must be kebab-case');

export const localeSchema = z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/);
export const currencySchema = z.string().length(3).toLowerCase();
