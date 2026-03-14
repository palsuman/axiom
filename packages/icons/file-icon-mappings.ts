import { FileIconTheme } from './file-icon-types';

export const BUILTIN_FILE_ICON_THEME: FileIconTheme = {
  folders: {
    default: 'icon.folder.default',
    expanded: 'icon.folder.default.open',
    root: 'icon.folder.root',
    rootExpanded: 'icon.folder.root.open',
    byName: {
      src: { collapsed: 'icon.folder.src', expanded: 'icon.folder.src.open' },
      dist: { collapsed: 'icon.folder.dist', expanded: 'icon.folder.dist.open' },
      node_modules: { collapsed: 'icon.folder.node-modules', expanded: 'icon.folder.node-modules.open' },
      assets: { collapsed: 'icon.folder.assets', expanded: 'icon.folder.assets.open' },
      tests: { collapsed: 'icon.folder.tests', expanded: 'icon.folder.tests.open' }
    }
  },
  files: {
    default: 'icon.file.default',
    byFileName: {
      'package.json': 'icon.file.package-json',
      'tsconfig.json': 'icon.file.tsconfig',
      'jsconfig.json': 'icon.file.tsconfig',
      'angular.json': 'icon.file.angular-json',
      'nx.json': 'icon.file.nx-json',
      'workspace.json': 'icon.file.nx-json',
      'readme.md': 'icon.file.readme',
      'license': 'icon.file.license',
      'dockerfile': 'icon.file.docker',
      '.editorconfig': 'icon.file.editorconfig',
      '.gitignore': 'icon.file.git',
      '.gitattributes': 'icon.file.git'
    },
    byLanguageId: {
      typescript: 'icon.file.typescript',
      javascript: 'icon.file.javascript',
      json: 'icon.file.json',
      html: 'icon.file.html',
      css: 'icon.file.css',
      scss: 'icon.file.scss',
      markdown: 'icon.file.markdown',
      yaml: 'icon.file.yaml',
      python: 'icon.file.python',
      go: 'icon.file.go',
      rust: 'icon.file.rust'
    },
    byCompoundExtension: {
      'd.ts': 'icon.file.typescript-definition',
      'spec.ts': 'icon.file.typescript-spec',
      'test.ts': 'icon.file.typescript-spec',
      'spec.js': 'icon.file.javascript-spec',
      'test.js': 'icon.file.javascript-spec'
    },
    byExtension: {
      ts: 'icon.file.typescript',
      tsx: 'icon.file.react',
      js: 'icon.file.javascript',
      jsx: 'icon.file.react',
      json: 'icon.file.json',
      md: 'icon.file.markdown',
      markdown: 'icon.file.markdown',
      html: 'icon.file.html',
      htm: 'icon.file.html',
      css: 'icon.file.css',
      scss: 'icon.file.scss',
      less: 'icon.file.less',
      yml: 'icon.file.yaml',
      yaml: 'icon.file.yaml',
      py: 'icon.file.python',
      go: 'icon.file.go',
      rs: 'icon.file.rust',
      java: 'icon.file.java',
      kt: 'icon.file.kotlin',
      kts: 'icon.file.kotlin',
      c: 'icon.file.c',
      h: 'icon.file.c',
      cpp: 'icon.file.cpp',
      hpp: 'icon.file.cpp',
      cs: 'icon.file.csharp',
      sh: 'icon.file.shell',
      bash: 'icon.file.shell',
      dockerfile: 'icon.file.docker',
      env: 'icon.file.env'
    }
  }
};
