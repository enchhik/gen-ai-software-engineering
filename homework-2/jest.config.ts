import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/server.ts',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      lines: 85,
    },
  },
};

export default config;