module.exports = {
  preset: 'jest-preset-angular',
  rootDir: __dirname,
  roots: ['<rootDir>/angular/src'],
  setupFilesAfterEnv: ['<rootDir>/angular/setup-jest.ts'],
  testEnvironment: 'jsdom',
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/angular/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$'
      }
    ]
  },
  moduleFileExtensions: ['ts', 'html', 'js', 'json', 'mjs']
};
