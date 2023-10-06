import * as Serverless from 'serverless';
import { ServerlessGlobalAuthorizerError } from './serverless-global-authorizer-error';
import Aws from 'serverless/aws';
import { defineServerlessSchema } from './define-serverless-schema';

type ApiGatewayEvent = (Aws.Http | Aws.HttpApiEvent) & { globalAuthorizerEnabled?: unknown };

class ServerlessGlobalAuthorizerPlugin {
  public hooks = {
    'before:package:initialize': this.init.bind(this),
  };

  public constructor(private serverless: Serverless) {
    serverless.getProvider('aws');

    defineServerlessSchema(serverless);
  }

  public init() {
    (this.serverless.service.getAllFunctions() || []).forEach(this.processFunction.bind(this));
  }

  private processFunction(functionName: string) {
    (this.serverless.service.getAllEventsInFunction(functionName) || []).forEach(
      this.processEvent.bind(this),
    );
  }

  private processEvent(event: Serverless.Event) {
    if (
      'http' in event &&
      event.http &&
      event.http.authorizer === undefined &&
      ServerlessGlobalAuthorizerPlugin.isGlobalAuthorizerEnabledAtEventLevel(event.http)
    ) {
      event.http = this.applyRestApiAuthorizer(event.http);
    } else if (
      'httpApi' in event &&
      event.httpApi &&
      event.httpApi.authorizer === undefined &&
      ServerlessGlobalAuthorizerPlugin.isGlobalAuthorizerEnabledAtEventLevel(event.httpApi)
    ) {
      event.httpApi = this.applyHttpApiAuthorizer(event.httpApi);
    }
  }

  private applyRestApiAuthorizer(event: Aws.Http | string): Aws.Http {
    // if event specified in shorthand syntax
    if (typeof event === 'string') {
      const [method, path] = event.split(' ');
      event = { method, path };
    }

    event.authorizer = this.getRestApiAuthorizerConfig();

    return event;
  }

  private applyHttpApiAuthorizer(event: Aws.HttpApiEvent | string): Aws.HttpApiEvent {
    // if event specified in shorthand syntax
    if (typeof event === 'string') {
      // if default route
      if (event === '*') {
        return {
          method: '*',
          path: '*',
          authorizer: this.getHttpApiAuthorizerConfig(),
        };
      }

      const [method, path] = event.split(' ');
      event = { method, path };
    }

    event.authorizer = this.getHttpApiAuthorizerConfig();

    return event;
  }

  private getRestApiAuthorizerConfig() {
    if (!this.serverless.service.custom?.globalAuthorizer?.restApi?.authorizer) {
      throw new ServerlessGlobalAuthorizerError(
        'Missing global authorizer configuration for REST API Gateway',
      );
    }

    return this.serverless.service.custom.globalAuthorizer.restApi?.authorizer;
  }

  private getHttpApiAuthorizerConfig() {
    if (!this.serverless.service.custom?.globalAuthorizer?.httpApi?.authorizer) {
      throw new ServerlessGlobalAuthorizerError(
        'Missing global authorizer configuration for HTTP API Gateway',
      );
    }

    return this.serverless.service.custom.globalAuthorizer.httpApi?.authorizer;
  }

  private static isGlobalAuthorizerEnabledAtEventLevel(event: ApiGatewayEvent | string) {
    if (typeof event === 'string' || event.globalAuthorizerEnabled === undefined) {
      return true;
    }

    if (event.globalAuthorizerEnabled !== false && event.globalAuthorizerEnabled !== true) {
      throw new ServerlessGlobalAuthorizerError(
        `"globalAuthorizerEnabled" property needs to be of boolean type. "${event.globalAuthorizerEnabled}" passed as a value`,
      );
    }

    return event.globalAuthorizerEnabled;
  }
}

export = ServerlessGlobalAuthorizerPlugin;
