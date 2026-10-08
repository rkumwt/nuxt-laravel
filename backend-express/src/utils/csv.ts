import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { stringify } from "csv-stringify";
import type { Response } from "express";

// Streams rows to the client as a CSV download without buffering them all
export const sendCsv = async (
  res: Response,
  fileName: string,
  headings: string[],
  rows: AsyncIterable<unknown[]>,
) => {
  res.setHeader("Content-Type", "text/csv; charset=UTF-8");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

  await pipeline(
    Readable.from(rows),
    stringify({ header: true, columns: headings, quoted: true }),
    res,
  );
};
