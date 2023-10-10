<a name="readme-top"></a>

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![MIT licensed](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/Unh3ck3d/serverless-global-authorizer/blob/main/LICENSE)
[![Code coverage](https://img.shields.io/codecov/c/gh/Unh3ck3d/serverless-global-authorizer?label=codecov&logo=codecov&style=flat-square)](https://codecov.io/gh/Unh3ck3d/serverless-global-authorizer)

<h3 align="center">serverless-global-authorizer</h3>
<p align="center">
 Serverless framework plugin which allows to configure API Gateway authorizer globally and applies it for all http/httpApi lambda function events
<br />
<a href="https://github.com/Unh3ck3d/serverless-global-authorizer/issues">Report Bug</a>
·
<a href="https://github.com/Unh3ck3d/serverless-global-authorizer/issues">Request Feature</a>
</p>

## About The Project

Currently, serverless framework does not allow to specify authorizer globally for all API Gateway endpoints. This leads to
configuration duplication and potential security issue in case someone forgot to apply authorizer to a new lambda function.

With this plugin you can configure authorizer globally, and it will be automatically
applied to all your `http` or `httpApi` lambda function events.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Requirements

* [Serverless framework](https://www.serverless.com/) >= 2.32
* [Node.js](https://nodejs.org) >= 12

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Installation

First you need to install it using your package manager.
```sh
npm install serverless-global-authorizer --save-dev
```

Then add it to `plugins` section of your serverless configuration file.

```yaml
plugins:
  - serverless-global-authorizer
```

And the last thing is configuration of API Gateway authorizer
```yaml
custom:
  globalAuthorizer:
    # if you use REST API Gateway
    restApi:
      authorizer:  # configuration of authorizer looks the same as in serverless framework e.g. for lambda authorizer https://www.serverless.com/framework/docs/providers/aws/events/apigateway#http-endpoints-with-custom-authorizers
        name: customAuthorizerRestApi
        type: request
        resultTtlInSeconds: 0
        arn: arn:aws:lambda:us-east-1:11111111111:function:external

    # if you use HTTP API Gateway
    httpApi:
      authorizer:
        name: customAuthorizerHttpApi


provider:
  name: aws
  # if you use HTTP API Gateway
  httpApi:
    authorizers:
      customAuthorizerHttpApi:  # configuration of authorizer looks the same as in serverless framework e.g. for lambda authorizer https://www.serverless.com/framework/docs/providers/aws/events/http-api
        type: request
        functionArn: arn:aws:lambda:us-east-1:11111111111:function:external
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## How it works

After you define global authorizer under
* `custom.globalAuthorizer.restApi.authorizer` key - for REST API Gateway
* `custom.globalAuthorizer.httpApi.authorizer` key - for HTTP API Gateway

plugin will apply iit for all `http` or `httpApi` events of your lambda functions.

If you don't want to apply global authorizer for given endpoint,
simply set `globalAuthorizerEnabled` event property to `false`.
<br/>e.g.
```yaml
functions:
  unprotected:
    handler: src/function/open/handler.handle
    events:
      - http:
          path: /open
          method: get
          globalAuthorizerEnabled: false
```

If your endpoint has authorizer specified in its config, plugin **won't** overwrite it
<br/>e.g.
```yaml
functions:
  iamProtected:
    handler: src/function/iam-protected/handler.handle
    events:
      - http:
          path: /open
          method: get
          authorizer:
            type: aws_iam   # IAM authorizer will be applied to this endpoint, plugin won't apply global authorizer here
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

Distributed under the MIT License. See `LICENSE` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>
