import {
  applyDecorators,
  Header,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';

// POST endpoint answering 200 with a CSV attachment (no JSON envelope)
export const CsvDownload = (path: string, fileName: string) =>
  applyDecorators(
    Post(path),
    HttpCode(HttpStatus.OK),
    Header('Content-Type', 'text/csv; charset=UTF-8'),
    Header('Content-Disposition', `attachment; filename="${fileName}"`),
  );
