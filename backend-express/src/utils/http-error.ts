export type ValidationErrors = Record<string, string[]>;

// Errors thrown anywhere in a request are turned into JSON by the error handler
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors: ValidationErrors | [] = [],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends HttpError {
  constructor(message = "Bad Request") {
    super(400, message);
  }
}

export class UnauthenticatedError extends HttpError {
  constructor(message = "Unauthenticated") {
    super(401, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "This action is unauthorized.") {
    super(403, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not Found") {
    super(404, message);
  }
}

export class ValidationError extends HttpError {
  constructor(errors: ValidationErrors, message = "Validation error") {
    super(422, message, errors);
  }

  static withMessage(field: string, message: string) {
    return new ValidationError({ [field]: [message] });
  }
}
