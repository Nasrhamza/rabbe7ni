import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
});

export interface PageInput {
  readonly page: number;
  readonly pageSize: number;
}

export function pageWindow(input: PageInput): { skip: number; take: number } {
  return {
    skip: (input.page - 1) * input.pageSize,
    take: input.pageSize,
  };
}

export function pageResult<T>(
  items: readonly T[],
  total: number,
  input: PageInput,
): {
  items: readonly T[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
} {
  return {
    items,
    total,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: Math.ceil(total / input.pageSize),
  };
}
