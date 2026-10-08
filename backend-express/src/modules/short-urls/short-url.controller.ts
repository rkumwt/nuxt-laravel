import type { Response } from "express";
import type { BodyRequest } from "../../types/http.js";
import { sendSuccess } from "../../utils/api-response.js";
import { authUser } from "../../utils/auth-user.js";
import { sendCsv } from "../../utils/csv.js";
import { toPageRequest } from "../../utils/pagination.js";
import { CLIENT_EXPORT_HEADINGS, COMPANY_EXPORT_HEADINGS } from "./short-url.resource.js";
import type {
  AllUrlsFilter,
  AllUrlsList,
  CompanyUrlsFilter,
  CompanyUrlsList,
  GenerateInput,
} from "./short-url.schema.js";
import type { ShortUrlService } from "./short-url.service.js";

const FETCHED = "Short Urls fetched successfully";

export class ShortUrlController {
  constructor(private readonly shortUrls: ShortUrlService) {}

  // Superadmin
  indexAll = async (req: BodyRequest<AllUrlsList>, res: Response) => {
    sendSuccess(res, FETCHED, await this.shortUrls.listAll(req.body, toPageRequest(req.body)));
  };

  downloadAll = async (req: BodyRequest<AllUrlsFilter>, res: Response) => {
    await sendCsv(res, "urls.csv", CLIENT_EXPORT_HEADINGS, this.shortUrls.exportAll(req.body));
  };

  // Admin / member
  index = async (req: BodyRequest<CompanyUrlsList>, res: Response) => {
    const result = await this.shortUrls.listForUser(
      authUser(req),
      req.body,
      toPageRequest(req.body),
    );
    sendSuccess(res, FETCHED, result);
  };

  download = async (req: BodyRequest<CompanyUrlsFilter>, res: Response) => {
    const rows = this.shortUrls.exportForUser(authUser(req), req.body);
    await sendCsv(res, "urls.csv", COMPANY_EXPORT_HEADINGS, rows);
  };

  generate = async (req: BodyRequest<GenerateInput>, res: Response) => {
    await this.shortUrls.generate(authUser(req), req.body.url);
    sendSuccess(res, "Short URL generated successfully");
  };
}
