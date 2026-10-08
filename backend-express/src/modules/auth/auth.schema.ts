import { z } from "zod";
import { required, requiredEmail } from "../../validation/rules.js";

// App\Http\Requests\Api\LoginRequest
export const loginSchema = z.object({
  email: requiredEmail("email"),
  password: required("password"),
});

export type LoginInput = z.infer<typeof loginSchema>;
