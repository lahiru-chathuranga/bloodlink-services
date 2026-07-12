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
