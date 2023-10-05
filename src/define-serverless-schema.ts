import * as Serverless from 'serverless';

const defineCustomPropertiesSchema = (serverless: Serverless) => {
  serverless.configSchemaHandler.defineCustomProperties({
    type: 'object',
    properties: {
      globalAuthorizer: {
        type: 'object',
        additionalProperties: false,
        properties: {
          restApi: {
            type: 'object',
            additionalProperties: false,
            properties: {
              authorizer: { anyOf: [{ type: 'object' }, { type: 'string' }] },
            },
            required: ['authorizer'],
          },
          httpApi: {
            type: 'object',
            additionalProperties: false,
            properties: {
              authorizer: { anyOf: [{ type: 'object' }, { type: 'string' }] },
            },
            required: ['authorizer'],
          },
        },
      },
    },
  });
};

const defineFunctionEventPropertiesSchema = (serverless: Serverless) => {
  const eventPropertiesSchema = {
    properties: {
      globalAuthorizerEnabled: { type: 'boolean' },
    },
  };
  serverless.configSchemaHandler.defineFunctionEventProperties(
    'aws',
    'http',
    eventPropertiesSchema,
  );
  serverless.configSchemaHandler.defineFunctionEventProperties(
    'aws',
    'httpApi',
    eventPropertiesSchema,
  );
};

export const defineServerlessSchema = (serverless: Serverless) => {
  defineCustomPropertiesSchema(serverless);
  defineFunctionEventPropertiesSchema(serverless);
};
