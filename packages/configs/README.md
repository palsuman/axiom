# @nexus/configs

Shared configuration package containing base settings for ESLint, Prettier, Jest, and TypeScript. Consumers extend these files instead of duplicating settings per project.

## Files
- `eslint/base.cjs`
- `prettier/base.cjs`
- `ts/tsconfig.base.json`
- `jest/jest.preset.cjs`

## Usage
Example root `.eslintrc.cjs`:
```js
module.exports = require('./packages/configs/eslint/base.cjs');
```

Prettier:
```js
module.exports = require('./packages/configs/prettier/base.cjs');
```

TypeScript:
```json
{
  "extends": "./packages/configs/ts/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  }
}
```

Jest preset:
```js
module.exports = require('./packages/configs/jest/jest.preset.cjs');
```
