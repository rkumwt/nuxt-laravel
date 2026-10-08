import { applyDecorators, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ResponseMessage } from './response-message.decorator.js';

// Every Laravel endpoint is a POST answering 200 with a message
// (Nest defaults POST to 201)
export const PostAction = (path: string, message: string) =>
  applyDecorators(
    Post(path),
    HttpCode(HttpStatus.OK),
    ResponseMessage(message),
  );
