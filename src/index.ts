import * as Serverless from 'serverless';
import { ServerlessGlobalAuthorizerError } from './serverless-global-authorizer-error';

class ServerlessGlobalAuthorizerPlugin {
  public hooks = {
    initialize: this.init.bind(this),
  };

  public constructor(private serverless: Serverless) {
    serverless.getProvider('aws');
  }

  public init() {
    this.serverless.service.getAllFunctions().forEach(this.processFunction.bind(this));
  }

  private processFunction(functionName: string) {
    (this.serverless.service.getAllEventsInFunction(functionName) || []).forEach(
      this.processEvent.bind(this),
    );
  }

  private processEvent(event: Serverless.Event) {
    if ('http' in event && event.http && event.http.authorizer === undefined) {
      event.http.authorizer = this.getRestApiAuthorizerConfig();
    } else if ('httpApi' in event && event.httpApi && event.httpApi.authorizer === undefined) {
      event.httpApi.authorizer = this.getHttpApiAuthorizerConfig();
    }
  }

  private getRestApiAuthorizerConfig() {
    if (!this.serverless.service.custom?.globalAuthorizer?.restApiAuthorizer) {
      throw new ServerlessGlobalAuthorizerError(
        'Missing global authorizer configuration for REST API Gateway',
      );
    }

    return this.serverless.service.custom.globalAuthorizer.restApiAuthorizer;
  }

  private getHttpApiAuthorizerConfig() {
    if (!this.serverless.service.custom?.globalAuthorizer?.httpApiAuthorizer) {
      throw new ServerlessGlobalAuthorizerError(
        'Missing global authorizer configuration for HTTP API Gateway',
      );
    }

    return this.serverless.service.custom.globalAuthorizer.httpApiAuthorizer;
  }
}

export = ServerlessGlobalAuthorizerPlugin;
