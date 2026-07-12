// Typed errors the error-handler middleware maps to HTTP statuses — API_CONVENTIONS.md.
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ValidationError extends ApiError {
  constructor(details: { field: string; message: string }[]) {
    super(400, "VALIDATION_ERROR", "Request validation failed.", details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Invalid or missing credentials.") {
    super(401, "UNAUTHORIZED", message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "You do not have permission to perform this action.") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Resource not found.") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends ApiError {
  constructor(code: string, message: string, details?: unknown) {
    super(409, code, message, details);
  }
}
