import { Reflector } from '@nestjs/core';

// The success message wrapped into { status, message, data } by ResponseEnvelopeInterceptor
export const ResponseMessage = Reflector.createDecorator<string>();
