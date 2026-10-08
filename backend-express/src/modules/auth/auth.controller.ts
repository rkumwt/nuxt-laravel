import type { Request, Response } from "express";
import type { BodyRequest } from "../../types/http.js";
import { sendSuccess } from "../../utils/api-response.js";
import { authUser } from "../../utils/auth-user.js";
import type { LoginInput } from "./auth.schema.js";
import type { AuthService } from "./auth.service.js";

export class AuthController {
  constructor(private readonly auth: AuthService) {}

  login = async (req: BodyRequest<LoginInput>, res: Response) => {
    const data = await this.auth.login(req.body);
    sendSuccess(res, "Login successful", data);
  };

  user = async (req: Request, res: Response) => {
    const user = await this.auth.profile(authUser(req).id);
    sendSuccess(res, "User Fetched successfully", { user });
  };

  logout = async (req: Request, res: Response) => {
    await this.auth.logout(req.auth!.accessToken.id);
    sendSuccess(res, "Logged out successfully");
  };
}
