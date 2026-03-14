module.exports = {
  preset: '../../packages/configs/jest/jest.preset.cjs',
  rootDir: __dirname,
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js']
};
