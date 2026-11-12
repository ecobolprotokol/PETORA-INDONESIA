import { z } from "zod";

function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export const branchSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9_-]{1,11}$/),
  name: z.string().trim().min(2).max(120),
  timezone: z.string().trim().min(1).refine(isValidTimeZone),
});

export type BranchInput = z.infer<typeof branchSchema>;
