import { z } from "zod";

/**
 * Schema gates for state-committing mutations.
 *
 * Nothing reaches the store (and therefore nothing reaches the network) unless
 * it parses. Phone numbers must be a valid Pakistani mobile in either
 * international (+923XXXXXXXXX) or local (03XXXXXXXXX) form.
 */

export const PK_PHONE_RE = /^(\+?923\d{9}|03\d{9})$/;

export const pkPhoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-()]/g, ""))
  .refine((v) => PK_PHONE_RE.test(v), {
    message: "Parent phone must be +923XXXXXXXXX or 03XXXXXXXXX",
  });

export const addStudentSchema = z.object({
  name: z.string().trim().min(2, "Student name is required").max(100),
  parentName: z.string().trim().min(2, "Parent name is required").max(100),
  parentPhone: pkPhoneSchema,
  branchId: z.string().trim().min(1, "Campus is required"),
  className: z.string().trim().min(1, "Level is required"),
  section: z.string().trim().min(1, "Section is required"),
  rollNo: z.string().trim().min(1, "Roll number is required").max(32),
  monthlyFee: z.number().int("Fees must be whole rupees").nonnegative().max(10_000_000),
  customFee: z.boolean(),
  admissionDate: z.string().trim().min(4),
  arrears: z.number().nonnegative().max(10_000_000),
});

export const customChallanSchema = z.object({
  student_id: z.string().trim().min(1, "Student is required"),
  title: z.string().trim().min(2, "Charge title is required").max(120),
  amount: z.number().positive("Amount must be greater than zero").max(10_000_000),
  due_date: z.string().trim().min(4, "Due date is required"),
});

export const cashSettlementSchema = z.object({
  student_id: z.string().trim().min(1),
  amount: z.number().positive("Amount must be greater than zero").max(10_000_000),
});

export const addGymMemberSchema = z.object({
  name: z.string().trim().min(2, "Member name is required").max(100),
  phone: pkPhoneSchema,
  packageId: z.string().trim().min(1, "Package is required"),
});

/** First human-readable issue from a failed parse. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}
