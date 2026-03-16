import { WorkbenchShell } from './workbench-shell';
import { PanelHostService, createDefaultPanelActions, createProblemSummary } from './panel-host-service';

describe('PanelHostService', () => {
  it('registers declarative panel contributions with the shell and renders their content', () => {
    const shell = new WorkbenchShell();
    const panels = new PanelHostService(shell);

    panels.registerContribution({
      id: 'panel.sample',
      title: 'Sample',
      order: 3,
      render: () => ({
        kind: 'empty',
        title: 'Sample',
        message: 'Panel contribution ready.'
      })
    });

    expect(shell.layoutSnapshot().panel.views.some(view => view.id === 'panel.sample')).toBe(true);
    expect(panels.renderPanel('panel.sample')).toEqual({
      kind: 'empty',
      title: 'Sample',
      message: 'Panel contribution ready.'
    });
  });

  it('removes disposed panel contributions from the shell host', () => {
    const shell = new WorkbenchShell();
    const panels = new PanelHostService(shell);

    const dispose = panels.registerContribution({
      id: 'panel.disposable',
      title: 'Disposable',
      order: 2,
      render: () => ({
        kind: 'empty',
        title: 'Disposable',
        message: 'Temporary'
      })
    });

    dispose();

    expect(shell.layoutSnapshot().panel.views.some(view => view.id === 'panel.disposable')).toBe(false);
    expect(panels.renderPanel('panel.disposable')).toEqual({
      kind: 'empty',
      title: 'panel.disposable',
      message: 'No panel contribution is registered for panel.disposable.'
    });
  });

  it('tracks output channels and problems for host-rendered panels', () => {
    const shell = new WorkbenchShell();
    const panels = new PanelHostService(shell);
    panels.appendOutputEntry('workbench', 'Workbench', 'Bootstrap ready');
    panels.appendOutputEntry('workbench', 'Workbench', 'Second entry', { level: 'warning' });
    panels.appendOutputEntry('extensions', 'Extensions', 'No extension logs yet');
    panels.setActiveOutputChannel('extensions');
    panels.replaceProblems([
      {
        id: 'problem-1',
        severity: 'warning',
        message: 'Unused variable',
        resource: 'workspace://src/app.ts',
        line: 14,
        column: 7,
        source: 'typescript'
      }
    ]);

    panels.registerContribution({
      id: 'panel.output',
      title: 'Output',
      order: 1,
      render: context => ({
        kind: 'output',
        title: 'Output',
        channels: context.outputChannels,
        activeChannelId: context.activeOutputChannelId,
        actions: createDefaultPanelActions()
      })
    });
    panels.registerContribution({
      id: 'panel.problems',
      title: 'Problems',
      order: 2,
      render: context => ({
        kind: 'problems',
        title: 'Problems',
        summary: createProblemSummary(context.problems),
        entries: context.problems
      })
    });

    expect(panels.renderPanel('panel.output')).toMatchObject({
      kind: 'output',
      activeChannelId: 'extensions'
    });
    expect(panels.renderPanel('panel.problems')).toMatchObject({
      kind: 'problems',
      summary: '1 warning'
    });
  });
});
