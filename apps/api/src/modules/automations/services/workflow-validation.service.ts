import { Injectable } from '@nestjs/common';

export interface ValidationError {
  nodeKey?: string;
  error: string;
  severity: 'ERROR' | 'WARNING';
}

@Injectable()
export class WorkflowValidationService {
  validateGraph(nodes: any[], edges: any[]): ValidationError[] {
    const errors: ValidationError[] = [];

    // 1. Must have exactly one trigger
    const triggers = nodes.filter((n) => n.type === 'TRIGGER');
    if (triggers.length === 0) {
      errors.push({ error: 'O workflow precisa ter pelo menos um gatilho de início.', severity: 'ERROR' });
    } else if (triggers.length > 1) {
      errors.push({ error: 'O workflow não pode ter mais de um gatilho de início.', severity: 'ERROR' });
    }

    // 2. Disconnected nodes
    const nodeKeys = new Set(nodes.map((n) => n.id || n.nodeKey));
    const connectedTargets = new Set(edges.map((e) => e.target));
    const connectedSources = new Set(edges.map((e) => e.source));

    for (const node of nodes) {
      const id = node.id || node.nodeKey;
      if (node.type !== 'TRIGGER' && !connectedTargets.has(id)) {
        errors.push({
          nodeKey: id,
          error: `O nó "${node.data?.label || node.name}" não está conectado a nenhuma origem.`,
          severity: 'WARNING',
        });
      }
      if (node.type !== 'TERMINAL' && node.blockType !== 'logic.end_success' && node.blockType !== 'logic.end_fail' && !connectedSources.has(id)) {
        errors.push({
          nodeKey: id,
          error: `O nó "${node.data?.label || node.name}" não tem nenhuma conexão de saída.`,
          severity: 'WARNING',
        });
      }
    }

    // 3. Simple loop detection (DFS)
    const adjacencyList: Map<string, string[]> = new Map();
    for (const edge of edges) {
      const list = adjacencyList.get(edge.source) || [];
      list.push(edge.target);
      adjacencyList.set(edge.source, list);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();
    let hasLoop = false;

    const dfs = (nodeId: string) => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (recStack.has(neighbor)) {
          hasLoop = true;
        }
      }
      recStack.delete(nodeId);
    };

    if (triggers.length > 0) {
      dfs(triggers[0].id || triggers[0].nodeKey);
    }

    if (hasLoop) {
      errors.push({
        error: 'Foi detectado um loop infinito ou recursão direta no fluxo. Adicione limites de tentativas ou desvios condicionais.',
        severity: 'ERROR',
      });
    }

    return errors;
  }
}
