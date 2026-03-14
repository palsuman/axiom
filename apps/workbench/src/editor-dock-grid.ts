export type DockOrientation = 'horizontal' | 'vertical';

type DockNodeBase = {
  id: string;
  weight: number;
};

export type DockGroupNode = DockNodeBase & {
  kind: 'group';
  groupId: string;
};

export type DockSplitNode = DockNodeBase & {
  kind: 'split';
  orientation: DockOrientation;
  children: DockNode[];
};

export type DockNode = DockGroupNode | DockSplitNode;

export type EditorGridState = {
  root: DockNode;
};

export type EditorGroupPlacement = {
  groupId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  path: DockOrientation[];
};

type NodeSearchEntry = {
  node: DockNode;
  parent: DockSplitNode | null;
  index: number;
};

let dockIdCounter = 0;

function nextDockId(prefix: string) {
  dockIdCounter += 1;
  return `${prefix}-${dockIdCounter.toString(36)}`;
}

function normalizeWeights(nodes: DockNode[]) {
  const sum = nodes.reduce((acc, node) => acc + (node.weight || 0), 0);
  if (sum <= 0) {
    const equal = nodes.length ? 1 / nodes.length : 1;
    nodes.forEach(node => {
      node.weight = equal;
    });
    return;
  }
  nodes.forEach(node => {
    node.weight = (node.weight || 0) / sum;
  });
}

export function createInitialGrid(groupId: string): EditorGridState {
  const groupNode: DockGroupNode = {
    id: nextDockId('dock-group'),
    kind: 'group',
    groupId,
    weight: 1
  };
  return { root: groupNode };
}

function findGroupNode(root: DockNode, groupId: string, parent: DockSplitNode | null = null): NodeSearchEntry | null {
  if (root.kind === 'group') {
    if (root.groupId === groupId) {
      return { node: root, parent, index: -1 };
    }
    return null;
  }
  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i];
    const result = findGroupNode(child, groupId, root);
    if (result) {
      if (result.parent === root) {
        result.index = i;
      }
      return result;
    }
  }
  return null;
}

function countGroups(node: DockNode): number {
  if (node.kind === 'group') return 1;
  return node.children.reduce((acc, child) => acc + countGroups(child), 0);
}

export function splitGroupNode(
  grid: EditorGridState,
  groupId: string,
  orientation: DockOrientation,
  newGroupId: string
): string {
  const entry = findGroupNode(grid.root, groupId);
  if (!entry || entry.node.kind !== 'group') {
    throw new Error(`Group ${groupId} not found`);
  }
  const existingNode = entry.node;
  const newGroupNode: DockGroupNode = {
    id: nextDockId('dock-group'),
    kind: 'group',
    groupId: newGroupId,
    weight: existingNode.weight
  };
  const splitNode: DockSplitNode = {
    id: nextDockId('dock-split'),
    kind: 'split',
    orientation,
    weight: existingNode.weight,
    children: [
      existingNode,
      newGroupNode
    ]
  };
  normalizeWeights(splitNode.children);
  if (!entry.parent) {
    grid.root = splitNode;
  } else {
    const parent = entry.parent;
    const idx = entry.index;
    parent.children[idx] = splitNode;
    normalizeWeights(parent.children);
  }
  return newGroupNode.groupId;
}

export function removeGroupNode(grid: EditorGridState, groupId: string): boolean {
  const totalGroups = countGroups(grid.root);
  if (totalGroups <= 1) {
    return false;
  }
  const entry = findGroupNode(grid.root, groupId);
  if (!entry || entry.node.kind !== 'group') {
    return false;
  }
  if (!entry.parent) {
    return false;
  }
  const parent = entry.parent;
  parent.children.splice(entry.index, 1);
  if (parent.children.length === 1) {
    const survivor = parent.children[0];
    collapseParent(grid, parent, survivor);
  } else {
    normalizeWeights(parent.children);
  }
  return true;
}

function collapseParent(grid: EditorGridState, parent: DockSplitNode, survivor: DockNode) {
  survivor.weight = parent.weight;
  if (parent === grid.root) {
    grid.root = survivor;
    return;
  }
  const stack: DockSplitNode[] = [];
  if (grid.root.kind === 'split') {
    stack.push(grid.root);
  }
  while (stack.length) {
    const node = stack.pop()!;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (child === parent) {
        node.children[i] = survivor;
        normalizeWeights(node.children);
        return;
      }
      if (child.kind === 'split') {
        stack.push(child);
      }
    }
  }
}

export function computeEditorPlacements(grid: EditorGridState): Record<string, EditorGroupPlacement> {
  const placements: Record<string, EditorGroupPlacement> = {};
  const root = grid.root;
  traverse(root, 0, 0, 1, 1, []);
  return placements;

  function traverse(node: DockNode, x: number, y: number, width: number, height: number, path: DockOrientation[]) {
    if (node.kind === 'group') {
      placements[node.groupId] = { groupId: node.groupId, x, y, width, height, path };
      return;
    }
    const total = node.children.reduce((acc, child) => acc + (child.weight || 0), 0) || node.children.length;
    let offset = 0;
    node.children.forEach(child => {
      const ratio = (child.weight || 0) / total || 1 / total;
      if (node.orientation === 'horizontal') {
        const childHeight = height * ratio;
        traverse(child, x, y + offset, width, childHeight, [...path, 'horizontal']);
        offset += childHeight;
      } else {
        const childWidth = width * ratio;
        traverse(child, x + offset, y, childWidth, height, [...path, 'vertical']);
        offset += childWidth;
      }
    });
  }
}

export function serializeGrid(grid: EditorGridState): EditorGridState {
  return {
    root: cloneNode(grid.root)
  };
}

function cloneNode(node: DockNode): DockNode {
  if (node.kind === 'group') {
    return { ...node };
  }
  return {
    ...node,
    children: node.children.map(child => cloneNode(child))
  };
}
