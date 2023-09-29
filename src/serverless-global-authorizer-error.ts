export class ServerlessGlobalAuthorizerError extends Error {
  constructor(message: string) {
    super(`[serverless-global-authorizer] ${message}`);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}
