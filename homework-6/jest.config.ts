import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  collectCoverage: false,
  collectCoverageFrom: [
    'lib/**/*.ts',
    'agents/**/*.ts',
    'mcp/handlers.ts',
    'scripts/validate.ts',
  ],
  coverageReporters: ['text', 'json-summary', 'lcov'],
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};

export default config;
