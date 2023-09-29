module.exports = {
  verbose: true,
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig-test.json' }],
  },
  collectCoverage: true,
  coverageReporters: [
    'json',
    'html',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
  ],
  reporters: [
    'default',
    'jest-summary-reporter',
  ],
  testMatch: [
    '<rootDir>/test/unit/**/*.test.{js,ts}',
  ],
  clearMocks: true,
  resetMocks: true,
};
