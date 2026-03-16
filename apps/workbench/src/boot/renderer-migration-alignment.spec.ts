import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../../..');

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('renderer migration alignment', () => {
  it('documents Angular as the primary renderer path and the DOM renderer as removed', () => {
    const tasks = read('tasks/TASKS.md');
    const tracker = read('tasks/TRACKER.md');
    const architecture = read('docs/ARCHITECTURE.md');
    const migrationDoc = read('docs/architecture/renderer-migration.md');
    const buildPipeline = read('docs/infra/build-pipeline.md');
    const electronShell = read('docs/architecture/electron-shell.md');
    const adrReadme = read('docs/adr/README.md');
    const adr12 = read('docs/adr/ADR-12.md');

    expect(tasks).toContain('Current renderer state: TypeScript services/classes plus direct DOM rendering compiled with `tsc`.');
    expect(tasks).toContain('Target renderer state: Angular provides the primary workbench UI once migration is complete.');
    expect(tracker).toContain('Only renderer migration work, migration blocker fixes, and documentation/package alignment may continue for the renderer until migration signoff is complete.');
    expect(architecture).toContain('Primary implementation: Angular shell host, standalone zoneless bootstrap');
    expect(architecture).toContain('Legacy DOM renderer: removed');
    expect(migrationDoc).toContain('Electron preload now launches the Angular renderer bundle as the default workbench path.');
    expect(migrationDoc).toContain('The historical TypeScript + direct DOM renderer preload path has been removed from Electron.');
    expect(buildPipeline).toContain('The historical preload-mounted DOM renderer has been removed from the Electron runtime path.');
    expect(buildPipeline).not.toContain('NEXUS_ENABLE_LEGACY_DOM_RENDERER');
    expect(electronShell).toContain('The historical compiled DOM renderer has been removed from preload.');
    expect(adrReadme).toContain('ADR-12');
    expect(adr12).toContain('The historical TypeScript + direct DOM renderer has now been removed from the Electron preload path.');
  });

  it('keeps package and workbench project expectations aligned with the current migration phase', () => {
    const packageJson = JSON.parse(read('package.json')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const projectJson = JSON.parse(read('apps/workbench/project.json')) as {
      targets: {
        build: { executor: string; options?: { command?: string } };
        'build-angular': { executor: string; options?: { command?: string } };
        'lint-angular': { executor: string; options?: { command?: string } };
        'test-angular': { executor: string; options?: { command?: string } };
        watch: { executor: string; options?: { command?: string } };
        test: { executor: string; options?: { command?: string } };
      };
    };
    const desktopProjectJson = JSON.parse(read('apps/desktop-shell/project.json')) as {
      targets: {
        serve: { options?: { command?: string } };
      };
    };

    const allDeps = {
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.devDependencies ?? {})
    };
    const angularDeps = Object.keys(allDeps).filter(key => key.startsWith('@angular/'));
    const angularCoreVersion = allDeps['@angular/core'];
    const angularCliVersion = allDeps['@angular/cli'];
    const angularJson = read('angular.json');
    const setupJest = read('apps/workbench/angular/setup-jest.ts');

    expect(angularDeps).toEqual(
      expect.arrayContaining([
        '@angular/cli',
        '@angular/core',
        '@angular/common',
        '@angular/platform-browser',
        '@angular/platform-browser-dynamic'
      ])
    );
    expect(angularCoreVersion).toMatch(/^21\./);
    expect(angularCliVersion).toMatch(/^21\./);
    expect(allDeps['typescript']).toMatch(/^5\.9\./);
    expect(allDeps['jest']).toMatch(/^30\./);
    expect(allDeps['jest-preset-angular']).toMatch(/^16\./);
    expect(allDeps['zone.js']).toBeUndefined();
    expect(angularJson).not.toContain('zone.js');
    expect(setupJest).toContain("setupZonelessTestEnv");
    expect(projectJson.targets.build.executor).toBe('nx:run-commands');
    expect(projectJson.targets.build.options?.command).toContain('tsc -p apps/workbench/tsconfig.app.json');
    expect(projectJson.targets['build-angular'].options?.command).toContain('ng build workbench-angular');
    expect(projectJson.targets['lint-angular'].options?.command).toContain('eslint apps/workbench/angular/src');
    expect(projectJson.targets['test-angular'].options?.command).toContain(
      'jest --config apps/workbench/jest.angular.config.cjs --runInBand'
    );
    const serveCommand = desktopProjectJson.targets.serve.options?.command ?? '';
    expect(serveCommand).toContain('yarn nx run workbench:build-angular');
    expect(serveCommand).not.toContain('&& yarn nx run workbench:build &&');
    expect(projectJson.targets.watch.options?.command).toContain('tsc -p apps/workbench/tsconfig.app.json --watch');
    expect(projectJson.targets.test.options?.command).toContain('jest --config apps/workbench/jest.config.cjs --runInBand');

    expect(read('apps/desktop-shell/src/preload/workbench-renderer-loader.ts')).not.toContain('NEXUS_ENABLE_LEGACY_DOM_RENDERER');
    expect(fs.existsSync(path.join(repoRoot, 'apps/workbench/src/shell/workbench-dom-renderer.ts'))).toBe(false);
  });

  it('keeps the migration alignment document cross-linked from the architecture docs', () => {
    const architecture = read('docs/ARCHITECTURE.md');
    const migrationDoc = read('docs/architecture/renderer-migration.md');
    expect(architecture).toContain('renderer-migration.md');
    expect(migrationDoc).toContain('This document is controlled by `IDE-207`, `IDE-208`, `IDE-209`, and `IDE-210`.');
    expect(migrationDoc).toContain('Paused renderer feature work may not resume until all of the following are true:');
  });
});
