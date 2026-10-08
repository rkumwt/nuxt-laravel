import { z } from "zod";
import {
  required,
  requiredEmail,
  requiredIn,
  requiredMin,
  sameAs,
} from "../../validation/rules.js";

// App\Http\Requests\Invitation\RegisterRequest (company_name is checked in the
// service, because it is only required for invitations from the global company)
export const registerSchema = z
  .object({
    name: required("name"),
    email: requiredEmail("email"),
    company_name: z.string().trim().optional(),
    password: requiredMin("password", 8),
    password_confirmation: required("password_confirmation"),
  })
  // same:password — `when` makes it run even if other fields failed, so all
  // errors come back at once like Laravel
  .refine((data) => data.password_confirmation === data.password, {
    ...sameAs("password_confirmation", "password"),
    when: ({ value }) =>
      typeof (value as { password_confirmation?: unknown })?.password_confirmation === "string",
  });

export type RegisterInput = z.infer<typeof registerSchema>;

// Shared by the client and team member invite forms
export const inviteSchema = z.object({
  name: required("name"),
  email: requiredEmail("email"),
});

export const teamMemberInviteSchema = inviteSchema.extend({
  role: requiredIn("role", ["admin", "member"] as const),
});

export type InviteInput = z.infer<typeof inviteSchema>;
export type TeamMemberInviteInput = z.infer<typeof teamMemberInviteSchema>;
