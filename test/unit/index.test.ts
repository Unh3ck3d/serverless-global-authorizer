import ServerlessGlobalAuthorizerPlugin = require('../../src');
import { mockDeep } from 'jest-mock-extended';
import * as Serverless from 'serverless';
import { ServerlessGlobalAuthorizerError } from '../../src/serverless-global-authorizer-error';

type FunctionTestCaseData = {
  name: string;
  inputEvents?: Serverless.Event[];
  expectedEvents?: Serverless.Event[];
};

const serverless = mockDeep<Serverless>();

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
  it('locks plugin to AWS provider only', () => {
    const result = new ServerlessGlobalAuthorizerPlugin(serverless);

    expect(serverless.getProvider).toHaveBeenCalledWith('aws');
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

    plugin.hooks.initialize();

    expect(lambdaEventsInput).toEqual(expectedLambdaEvents);
  });

  it('throws error when global authorizer config missing and lambda with http event', () => {
    const plugin = new ServerlessGlobalAuthorizerPlugin(serverless);
    serverless.service.custom = {
      globalAuthorizer: {
        httpApiAuthorizer: { name: 'customAuthorizerHttpApi' },
      },
    };
    serverless.service.getAllFunctions.mockReturnValue(['function1']);
    serverless.service.getAllEventsInFunction.mockReturnValue([
      {
        http: { path: '/test', method: 'get' },
      },
    ]);

    expect(() => {
      plugin.hooks.initialize();
    }).toThrowError(
      new ServerlessGlobalAuthorizerError(
        'Missing global authorizer configuration for REST API Gateway',
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
            inputEvents: [{ http: { path: '/open', method: 'get', authorizer: null } }],
            expectedEvents: [{ http: { path: '/open', method: 'get', authorizer: null } }],
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
          restApiAuthorizer: restApiAuthorizerConfig,
        },
      };
      mockServerlessForTestCases(functions);

      plugin.hooks.initialize();

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
            inputEvents: [{ httpApi: { path: '/open', method: 'get', authorizer: null } }],
            expectedEvents: [{ httpApi: { path: '/open', method: 'get', authorizer: null } }],
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
        ],
      ],
    ])('when HTTP API authorizer = %p and functions = %p', (httpApiAuthorizerConfig, functions) => {
      const plugin = new ServerlessGlobalAuthorizerPlugin(serverless);
      serverless.service.custom = {
        globalAuthorizer: {
          httpApiAuthorizer: httpApiAuthorizerConfig,
        },
      };
      mockServerlessForTestCases(functions);

      plugin.hooks.initialize();

      assertModifiedInputEventsMatchExpectations(functions);
    });
  });

  describe('when both REST API Gateway and HTTP API Gateway global authorizers used', () => {
    const globalAuthorizerConfig = {
      httpApiAuthorizer: { type: 'aws_iam' },
      restApiAuthorizer: {
        name: 'customAuthorizerRestApi',
        type: 'request',
        resultTtlInSeconds: 0,
        arn: 'arn:aws:lambda:us-east-1:11111111111:function:external',
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
                  authorizer: globalAuthorizerConfig.httpApiAuthorizer,
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
                  authorizer: globalAuthorizerConfig.restApiAuthorizer,
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
                  authorizer: globalAuthorizerConfig.restApiAuthorizer,
                },
              },
              {
                httpApi: {
                  path: '/test2',
                  method: 'post',
                  authorizer: globalAuthorizerConfig.httpApiAuthorizer,
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

      plugin.hooks.initialize();

      assertModifiedInputEventsMatchExpectations(functions);
    });
  });
});
