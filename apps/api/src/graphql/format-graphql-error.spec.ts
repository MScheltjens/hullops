import type { GraphQLFormattedError } from 'graphql';
import { formatGraphqlError } from './format-graphql-error';

// The shapes below were captured from real responses of this API.
const conflict: GraphQLFormattedError = {
  message: 'A vessel with IMO number 9074729 already exists',
  path: ['createVessel'],
  extensions: {
    code: 'INTERNAL_SERVER_ERROR',
    status: 409,
    stacktrace: ['ConflictException: ...'],
    originalError: {
      message: 'A vessel with IMO number 9074729 already exists',
      error: 'Conflict',
      statusCode: 409,
    },
  },
};

const validation: GraphQLFormattedError = {
  message: 'Bad Request Exception',
  path: ['createVessel'],
  extensions: {
    code: 'BAD_REQUEST',
    originalError: {
      message: [
        'imoNumber must be a valid 7-digit IMO number',
        'lengthM must be a positive number',
      ],
      error: 'Bad Request',
      statusCode: 400,
    },
  },
};

const unexpected: GraphQLFormattedError = {
  message: "Can't reach database server at localhost:5432",
  path: ['vessels'],
  extensions: { code: 'INTERNAL_SERVER_ERROR', stacktrace: ['Error: ...'] },
};

describe('formatGraphqlError', () => {
  it('gives an HTTP exception the code for its status', () => {
    const result = formatGraphqlError(conflict, false);
    expect(result.message).toBe(conflict.message);
    expect(result.extensions?.code).toBe('CONFLICT');
    expect(result.extensions).not.toHaveProperty('originalError');
  });

  it('keeps the existing code for a status without a mapping', () => {
    const teapot: GraphQLFormattedError = {
      message: "I'm a teapot",
      extensions: {
        code: 'IM_A_TEAPOT',
        originalError: { message: "I'm a teapot", statusCode: 418 },
      },
    };
    expect(formatGraphqlError(teapot, false).extensions?.code).toBe(
      'IM_A_TEAPOT',
    );
  });

  it('lists validation failures under validationErrors', () => {
    const result = formatGraphqlError(validation, false);
    expect(result.message).toBe('Validation failed');
    expect(result.extensions).toMatchObject({
      code: 'BAD_REQUEST',
      validationErrors: [
        'imoNumber must be a valid 7-digit IMO number',
        'lengthM must be a positive number',
      ],
    });
    expect(result.extensions).not.toHaveProperty('originalError');
  });

  it('passes unexpected errors through outside production', () => {
    expect(formatGraphqlError(unexpected, false)).toEqual(unexpected);
  });

  it('hides the details of unexpected errors in production', () => {
    expect(formatGraphqlError(unexpected, true)).toEqual({
      message: 'Internal server error',
      path: ['vessels'],
      locations: undefined,
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    });
  });

  it('leaves GraphQL validation errors alone, even in production', () => {
    const invalidQuery: GraphQLFormattedError = {
      message: 'Cannot query field "nope" on type "Vessel".',
      extensions: { code: 'GRAPHQL_VALIDATION_FAILED' },
    };
    expect(formatGraphqlError(invalidQuery, true)).toEqual(invalidQuery);
  });
});
