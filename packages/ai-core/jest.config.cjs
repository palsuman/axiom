module.exports = {
  preset: '../configs/jest/jest.preset.cjs',
  rootDir: __dirname,
  roots: ['<rootDir>'],
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js'],
  moduleNameMapper: {
    '^@nexus/(.*)$': '<rootDir>/../$1'
  }
};
