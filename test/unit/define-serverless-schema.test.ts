import { mockDeep } from 'jest-mock-extended';
import * as Serverless from 'serverless';
import { defineServerlessSchema } from '../../src/define-serverless-schema';

describe('define-serverless-schema tests', () => {
  it('registers schema', () => {
    const serverless = mockDeep<Serverless>();

    defineServerlessSchema(serverless);

    expect(serverless.configSchemaHandler.defineCustomProperties).toHaveBeenCalled();
    expect(serverless.configSchemaHandler.defineFunctionEventProperties).toHaveBeenCalledWith(
      'aws',
      'http',
      expect.anything(),
    );
    expect(serverless.configSchemaHandler.defineFunctionEventProperties).toHaveBeenCalledWith(
      'aws',
      'httpApi',
      expect.anything(),
    );
  });
});
