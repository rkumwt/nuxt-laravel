import { z } from "zod";

// Builders that reproduce Laravel's validation rules and English messages
// (lang/en/validation.php), so both frontends show the same errors.

const label = (field: string) => field.replace(/_/g, " ");

// Laravel trims strings and converts "" to null before validating
const blankToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value ?? undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

/** required|string */
export const required = (field: string) =>
  z.preprocess(
    blankToUndefined,
    z.string({
      error: (issue) =>
        issue.input === undefined
          ? `The ${label(field)} field is required.`
          : `The ${label(field)} field must be a string.`,
    }),
  );

/** required|email */
export const requiredEmail = (field: string) =>
  required(field).pipe(z.email(`The ${label(field)} field must be a valid email address.`));

/** required|min:n (string length) */
export const requiredMin = (field: string, min: number) =>
  required(field).pipe(
    z.string().min(min, `The ${label(field)} field must be at least ${min} characters.`),
  );

/** required|in:a,b */
export const requiredIn = <const T extends readonly [string, ...string[]]>(
  field: string,
  values: T,
) => required(field).pipe(z.enum(values, { error: `The selected ${label(field)} is invalid.` }));

/** required|regex:pattern with a custom message */
export const requiredRegex = (field: string, pattern: RegExp, message: string) =>
  required(field).pipe(z.string().regex(pattern, message));

/** nullable|date_format:Y-m-d */
export const optionalDate = (field: string) =>
  z.preprocess(
    blankToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, `The ${label(field)} field must match the format Y-m-d.`)
      .optional(),
  );

/** nullable|integer */
export const optionalInteger = (field: string) =>
  z.preprocess(
    blankToUndefined,
    z.coerce
      .number({ error: `The ${label(field)} field must be an integer.` })
      .int()
      .positive()
      .optional(),
  );

/** same:other (options for an object-level .refine) */
export const sameAs = (field: string, other: string) => ({
  path: [field],
  message: `The ${label(field)} field must match ${label(other)}.`,
});

export const uniqueMessage = (field: string) => `The ${label(field)} has already been taken.`;

// Collects zod issues into Laravel's { field: [messages] } shape
export const toValidationErrors = (error: z.ZodError) => {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (errors[key] ??= []).push(issue.message);
  }
  return errors;
};
