import { Readable, pipeline } from 'node:stream';
import { stringify } from 'csv-stringify';

// Turns rows into a CSV stream (used with StreamableFile); nothing is buffered
export const toCsvStream = (
  headings: string[],
  rows: AsyncIterable<unknown[]>,
) => {
  const csv = stringify({ header: true, columns: headings, quoted: true });
  // pipeline destroys `csv` if reading rows fails, which aborts the download
  pipeline(Readable.from(rows), csv, () => undefined);
  return csv;
};
