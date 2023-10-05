import ServerlessGlobalAuthorizerPlugin = require('../../src');
import { mockDeep } from 'jest-mock-extended';
import * as Serverless from 'serverless';
import { ServerlessGlobalAuthorizerError } from '../../src/serverless-global-authorizer-error';
import { defineServerlessSchema } from '../../src/define-serverless-schema';

type FunctionTestCaseData = {
  name: string;
  inputEvents?: Serverless.Event[];
  expectedEvents?: Serverless.Event[];
};

const serverless = mockDeep<Serverless>();

jest.mock('../../src/define-serverless-schema', () => ({
  defineServerlessSchema: jest.fn(),
}));

const mockServerlessForTestCases = (functions: FunctionTestCaseData[]) => {
  serverless.service.getAllFunctions.mockReturnValue(functions.map((f) => f.name));
  serverless.service.getAllEventsInFunction.mockImplementation(
    (functionName) => functions.find((f) => f.name === functionName)?.inputEvents ?? [],
  );
};

const assertModifiedInputEventsMatchExpectations = (functions: FunctionTestCaseData[]) => {
  functions.forEach((f) => {
    expect(f.inputEvents).toEqual(f.expectedEvents);
  });
};

describe('plugin tests', () => {
  it('constructor locks plugin to AWS provider only and defines serverless schema', () => {
    const result = new ServerlessGlobalAuthorizerPlugin(serverless);

    expect(serverless.getProvider).toHaveBeenCalledWith('aws');
    expect(defineServerlessSchema).toHaveBeenCalledWith(serverless);
    expect(result).toBeInstanceOf(ServerlessGlobalAuthorizerPlugin);
  });

  it('does nothing when no lambda function with either http or httpApi event', () => {
    const plugin = new ServerlessGlobalAuthorizerPlugin(serverless);
    const lambdaEventsInput = [
      {
        sqs: { arn: 'arn:aws:sqs' },
      },
    ];
    const expectedLambdaEvents = JSON.parse(JSON.stringify(lambdaEventsInput));
    serverless.service.getAllFunctions.mockReturnValue(['function1']);
    serverless.service.getAllEventsInFunction.mockReturnValue(lambdaEventsInput);

    plugin.hooks['before:package:initialize']();

    expect(lambdaEventsInput).toEqual(expectedLambdaEvents);
  });

  it('throws error when global authorizer config missing and lambda with http event', () => {
    const plugin = new ServerlessGlobalAuthorizerPlugin(serverless);
    serverless.service.custom = {
      globalAuthorizer: {
        httpApi: { authorizer: { name: 'customAuthorizerHttpApi' } },
      },
    };
    serverless.service.getAllFunctions.mockReturnValue(['function1']);
    serverless.service.getAllEventsInFunction.mockReturnValue([
      {
        http: { path: '/test', method: 'get' },
      },
    ]);

    expect(() => {
      plugin.hooks['before:package:initialize']();
    }).toThrowError(
      new ServerlessGlobalAuthorizerError(
        'Missing global authorizer configuration for REST API Gateway',
      ),
    );
  });

  it('throws error when globalAuthorizerEnabled http event property is not boolean', () => {
    const plugin = new ServerlessGlobalAuthorizerPlugin(serverless);
    serverless.service.custom = {
      globalAuthorizer: {
        http: { authorizer: 'aws_iam' },
      },
    };
    serverless.service.getAllFunctions.mockReturnValue(['function1']);
    serverless.service.getAllEventsInFunction.mockReturnValue([
      {
        http: { path: '/test', method: 'get', globalAuthorizerEnabled: 'invalid' },
      },
    ]);

    expect(() => {
      plugin.hooks['before:package:initialize']();
    }).toThrowError(
      new ServerlessGlobalAuthorizerError(
        '"globalAuthorizerEnabled" property needs to be of boolean type. "invalid" passed as a value',
      ),
    );
  });

  it('throws error when globalAuthorizerEnabled httpApi event property is not boolean', () => {
    const plugin = new ServerlessGlobalAuthorizerPlugin(serverless);
    serverless.service.custom = {
      globalAuthorizer: {
        httpApi: { authorizer: { type: 'aws_iam' } },
      },
    };
    serverless.service.getAllFunctions.mockReturnValue(['function1']);
    serverless.service.getAllEventsInFunction.mockReturnValue([
      {
        httpApi: { path: '/test', method: 'post', globalAuthorizerEnabled: 'invalid' },
      },
    ]);

    expect(() => {
      plugin.hooks['before:package:initialize']();
    }).toThrowError(
      new ServerlessGlobalAuthorizerError(
        '"globalAuthorizerEnabled" property needs to be of boolean type. "invalid" passed as a value',
      ),
    );
  });

  describe('when REST API Gateway global authorizer used', () => {
    const lambdaAuthorizer = {
      name: 'authorizerFunc',
      resultTtlInSeconds: 60,
      identitySource: 'method.request.header.Authorization',
      type: 'token',
    };

    test.each<[unknown, FunctionTestCaseData[]]>([
      [
        'aws_iam',
        [
          {
            name: 'kinesisFunction',
            inputEvents: [{ stream: { type: 'kinesis', arn: 'arn:aws:kinesis' } }],
            expectedEvents: [{ stream: { type: 'kinesis', arn: 'arn:aws:kinesis' } }],
          },
          {
            name: 'httpAndSQSFunction',
            inputEvents: [
              { sqs: { arn: 'arn:aws:sqs' } },
              { http: { path: '/test1', method: 'post', cors: true } },
            ],
            expectedEvents: [
              { sqs: { arn: 'arn:aws:sqs' } },
              { http: { path: '/test1', method: 'post', cors: true, authorizer: 'aws_iam' } },
            ],
          },
          {
            name: 'httpThatShouldNotHaveAuthorizerFunction',
            inputEvents: [
              { http: { path: '/open', method: 'get', globalAuthorizerEnabled: false } },
            ],
            expectedEvents: [
              { http: { path: '/open', method: 'get', globalAuthorizerEnabled: false } },
            ],
          },
          {
            name: 'httpProxyResourceFunction',
            inputEvents: [{ http: 'ANY /{proxy+}' }],
            expectedEvents: [{ http: { method: 'ANY', path: '/{proxy+}', authorizer: 'aws_iam' } }],
          },
          {
            name: 'httpRootPathShortSyntaxFunction',
            inputEvents: [{ http: 'PUT /' }],
            expectedEvents: [{ http: { method: 'PUT', path: '/', authorizer: 'aws_iam' } }],
          },
          {
            name: 'httpWithExplicitlyEnabledGlobalAuthorizerFunction',
            inputEvents: [
              { http: { path: '/test', method: 'post', globalAuthorizerEnabled: true } },
            ],
            expectedEvents: [
              {
                http: {
                  path: '/test',
                  method: 'post',
                  globalAuthorizerEnabled: true,
                  authorizer: 'aws_iam',
                },
              },
            ],
          },
        ],
      ],

      [
        lambdaAuthorizer,
        [
          {
            name: 'dynamoDBFunction',
            inputEvents: [{ stream: { type: 'dynamodb', arn: 'arn:aws:dynamodb' } }],
            expectedEvents: [{ stream: { type: 'dynamodb', arn: 'arn:aws:dynamodb' } }],
          },
          {
            name: 'twoHttpEventsFunction',
            inputEvents: [
              { http: { path: '/path1/{id}', method: 'patch', cors: true } },
              { http: { path: '/path2', method: 'get', cors: true } },
            ],
            expectedEvents: [
              {
                http: {
                  path: '/path1/{id}',
                  method: 'patch',
                  cors: true,
                  authorizer: lambdaAuthorizer,
                },
              },
              { http: { path: '/path2', method: 'get', cors: true, authorizer: lambdaAuthorizer } },
            ],
          },
          {
            name: 'httpWithOtherAuthorizerDefinedFunction',
            inputEvents: [
              { http: { path: '/open', method: 'get', authorizer: { type: 'aws_iam' } } },
            ],
            expectedEvents: [
              { http: { path: '/open', method: 'get', authorizer: { type: 'aws_iam' } } },
            ],
          },
        ],
      ],
    ])('when REST API authorizer = %p and functions = %p', (restApiAuthorizerConfig, functions) => {
      const plugin = new ServerlessGlobalAuthorizerPlugin(serverless);
      serverless.service.custom = {
        globalAuthorizer: {
          restApi: { authorizer: restApiAuthorizerConfig },
        },
      };
      mockServerlessForTestCases(functions);

      plugin.hooks['before:package:initialize']();

      assertModifiedInputEventsMatchExpectations(functions);
    });
  });

  describe('when HTTP API Gateway global authorizer used', () => {
    test.each<[unknown, FunctionTestCaseData[]]>([
      [
        { type: 'aws_iam' },
        [
          {
            name: 'noEventsFunction',
            inputEvents: undefined,
            expectedEvents: undefined,
          },
          {
            name: 'snsFunction',
            inputEvents: [{ sns: { topic: 'topic' } }],
            expectedEvents: [{ sns: { topic: 'topic' } }],
          },
          {
            name: 'httpApiAndSQSFunction',
            inputEvents: [
              { sqs: { arn: 'arn:aws:sqs' } },
              { httpApi: { path: '/test1', method: 'post' } },
            ],
            expectedEvents: [
              { sqs: { arn: 'arn:aws:sqs' } },
              { httpApi: { path: '/test1', method: 'post', authorizer: { type: 'aws_iam' } } },
            ],
          },
          {
            name: 'httpApiThatShouldNotHaveAuthorizerFunction',
            inputEvents: [
              { httpApi: { path: '/open', method: 'get', globalAuthorizerEnabled: false } },
            ],
            expectedEvents: [
              { httpApi: { path: '/open', method: 'get', globalAuthorizerEnabled: false } },
            ],
          },
        ],
      ],

      [
        { name: 'customHttpAuthorizer' },
        [
          {
            name: 'dynamoDBFunction',
            inputEvents: [{ stream: { type: 'dynamodb', arn: 'arn:aws:dynamodb' } }],
            expectedEvents: [{ stream: { type: 'dynamodb', arn: 'arn:aws:dynamodb' } }],
          },
          {
            name: 'twoHttpApiEventsFunction',
            inputEvents: [
              { httpApi: { path: '/path1/{id}', method: 'patch' } },
              { httpApi: { path: '/path2', method: 'get' } },
            ],
            expectedEvents: [
              {
                httpApi: {
                  path: '/path1/{id}',
                  method: 'patch',
                  authorizer: { name: 'customHttpAuthorizer' },
                },
              },
              {
                httpApi: {
                  path: '/path2',
                  method: 'get',
                  authorizer: { name: 'customHttpAuthorizer' },
                },
              },
            ],
          },
          {
            name: 'httpApiWithOtherAuthorizerDefinedFunction',
            inputEvents: [
              { httpApi: { path: '/open', method: 'post', authorizer: { type: 'aws_iam' } } },
            ],
            expectedEvents: [
              { httpApi: { path: '/open', method: 'post', authorizer: { type: 'aws_iam' } } },
            ],
          },
          {
            name: 'httpApiDefaultRouteFunction',
            inputEvents: [{ httpApi: '*' }],
            expectedEvents: [
              { httpApi: { path: '*', method: '*', authorizer: { name: 'customHttpAuthorizer' } } },
            ],
          },
          {
            name: 'httpApiShortSyntaxFunction',
            inputEvents: [{ httpApi: 'GET /path1' }],
            expectedEvents: [
              {
                httpApi: {
                  path: '/path1',
                  method: 'GET',
                  authorizer: { name: 'customHttpAuthorizer' },
                },
              },
            ],
          },
          {
            name: 'httpApiWithExplicitlyEnabledGlobalAuthorizerFunction',
            inputEvents: [
              { httpApi: { path: '/path', method: 'post', globalAuthorizerEnabled: true } },
            ],
            expectedEvents: [
              {
                httpApi: {
                  path: '/path',
                  method: 'post',
                  globalAuthorizerEnabled: true,
                  authorizer: { name: 'customHttpAuthorizer' },
                },
              },
            ],
          },
        ],
      ],
    ])('when HTTP API authorizer = %p and functions = %p', (httpApiAuthorizerConfig, functions) => {
      const plugin = new ServerlessGlobalAuthorizerPlugin(serverless);
      serverless.service.custom = {
        globalAuthorizer: {
          httpApi: { authorizer: httpApiAuthorizerConfig },
        },
      };
      mockServerlessForTestCases(functions);

      plugin.hooks['before:package:initialize']();

      assertModifiedInputEventsMatchExpectations(functions);
    });
  });

  describe('when both REST API Gateway and HTTP API Gateway global authorizers used', () => {
    const globalAuthorizerConfig = {
      httpApi: { authorizer: { type: 'aws_iam' } },
      restApi: {
        authorizer: {
          name: 'customAuthorizerRestApi',
          type: 'request',
          resultTtlInSeconds: 0,
          arn: 'arn:aws:lambda:us-east-1:11111111111:function:external',
        },
      },
    };

    test.each<[FunctionTestCaseData[]]>([
      [
        [
          {
            name: 'noEventsFunction',
            inputEvents: undefined,
            expectedEvents: undefined,
          },
          {
            name: 'snsFunction',
            inputEvents: [{ sns: { topic: 'topic' } }],
            expectedEvents: [{ sns: { topic: 'topic' } }],
          },
          {
            name: 'httpApiFunction',
            inputEvents: [{ httpApi: { path: '/', method: 'get' } }],
            expectedEvents: [
              {
                httpApi: {
                  path: '/',
                  method: 'get',
                  authorizer: globalAuthorizerConfig.httpApi.authorizer,
                },
              },
            ],
          },
          {
            name: 'httpFunction',
            inputEvents: [{ http: { path: '/dummy/path', method: 'get' } }],
            expectedEvents: [
              {
                http: {
                  path: '/dummy/path',
                  method: 'get',
                  authorizer: globalAuthorizerConfig.restApi.authorizer,
                },
              },
            ],
          },
          {
            name: 'httpApiAndHttpFunction',
            inputEvents: [
              { http: { path: '/test1', method: 'get', cors: true } },
              { httpApi: { path: '/test2', method: 'post' } },
            ],
            expectedEvents: [
              {
                http: {
                  path: '/test1',
                  method: 'get',
                  cors: true,
                  authorizer: globalAuthorizerConfig.restApi.authorizer,
                },
              },
              {
                httpApi: {
                  path: '/test2',
                  method: 'post',
                  authorizer: globalAuthorizerConfig.httpApi.authorizer,
                },
              },
            ],
          },
        ],
      ],
    ])('when functions = %p', (functions) => {
      const plugin = new ServerlessGlobalAuthorizerPlugin(serverless);
      serverless.service.custom = {
        globalAuthorizer: globalAuthorizerConfig,
      };
      mockServerlessForTestCases(functions);

      plugin.hooks['before:package:initialize']();

      assertModifiedInputEventsMatchExpectations(functions);
    });
  });
});
