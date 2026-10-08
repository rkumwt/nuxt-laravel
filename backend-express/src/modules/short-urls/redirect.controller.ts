import type { Request, Response } from "express";
import type { ShortUrlService } from "./short-url.service.js";

// Links saved as "www.example.com" (allowed by the validation pattern) need a
// scheme, otherwise the browser would treat them as a path on this host
const absolute = (url: string) => (/^https?:\/\//i.test(url) ? url : `http://${url}`);

export class RedirectController {
  constructor(private readonly shortUrls: ShortUrlService) {}

  redirect = async (req: Request<{ code: string }>, res: Response) => {
    const url = await this.shortUrls.resolve(req.params.code);

    if (!url) {
      res.status(404).type("text/plain").send("Short URL not found");
      return;
    }

    res.redirect(302, absolute(url));
  };
}
