/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@ai-fleet/domain$': '<rootDir>/../../packages/domain/src/index.ts',
    '^@ai-fleet/adapters$': '<rootDir>/../../packages/adapters/src/index.ts',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        diagnostics: false,
      },
    ],
  },
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  testTimeout: 15000,
};
