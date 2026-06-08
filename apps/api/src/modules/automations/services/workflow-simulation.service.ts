import { Injectable } from '@nestjs/common';
import { ExpressionEvaluator } from './expression-evaluator';

export interface SimulationStep {
  nodeKey: string;
  nodeType: string;
  name: string;
  status: 'COMPLETED' | 'SKIPPED' | 'FAILED';
  message: string;
  outputVariables: any;
}

@Injectable()
export class WorkflowSimulationService {
  async simulate(
    nodes: any[],
    edges: any[],
    initialContext: any
  ): Promise<{ steps: SimulationStep[]; finalContext: any }> {
    const steps: SimulationStep[] = [];
    const context = { ...initialContext };

    // Find trigger
    const trigger = nodes.find((n) => n.type === 'TRIGGER' || n.nodeType === 'TRIGGER');
    if (!trigger) {
      return {
        steps: [{ nodeKey: 'none', nodeType: 'TRIGGER', name: 'Gatilho', status: 'FAILED', message: 'Gatilho de início não encontrado.', outputVariables: {} }],
        finalContext: context,
      };
    }

    const nodeMap = new Map<string, any>();
    for (const n of nodes) nodeMap.set(n.id || n.nodeKey, n);

    const adjacencyList: Map<string, any[]> = new Map();
    for (const edge of edges) {
      const list = adjacencyList.get(edge.source || edge.sourceNodeKey) || [];
      list.push(edge);
      adjacencyList.set(edge.source || edge.sourceNodeKey, list);
    }

    // BFS queue for simulation execution
    const queue: { nodeId: string; incomingVariables: any; sourceHandle?: string }[] = [];
    queue.push({ nodeId: trigger.id || trigger.nodeKey, incomingVariables: context });

    const executed = new Set<string>();
    let safetyCounter = 0;

    while (queue.length > 0 && safetyCounter < 100) {
      safetyCounter++;
      const current = queue.shift()!;
      const node = nodeMap.get(current.nodeId);
      if (!node) continue;

      const id = node.id || node.nodeKey;
      const type = node.type || node.nodeType;
      const name = node.data?.label || node.name;
      const config = typeof node.configuration === 'string' ? JSON.parse(node.configuration) : node.configuration || {};

      let stepStatus: SimulationStep['status'] = 'COMPLETED';
      let message = `Executado com sucesso.`;
      let nodeOutput: any = {};

      switch (type) {
        case 'TRIGGER':
          message = `Gatilho acionado. Variáveis iniciais importadas.`;
          nodeOutput = { ...current.incomingVariables };
          break;

        case 'CONDITION':
          const conditionResult = ExpressionEvaluator.evaluate(config.condition, context);
          nodeOutput = { result: conditionResult };
          message = `Condição avaliada como ${conditionResult}.`;
          break;

        case 'LOGIC':
          if (node.blockType === 'logic.if_else') {
            const ifResult = ExpressionEvaluator.evaluate(config.condition, context);
            nodeOutput = { result: ifResult };
            message = `Se/Senão avaliado como ${ifResult}.`;
          } else if (node.blockType === 'logic.end_success') {
            message = `Finalizado com sucesso.`;
          } else if (node.blockType === 'logic.end_fail') {
            message = `Finalizado com falha: ${config.errorMessage || 'Falha simulada'}`;
            stepStatus = 'FAILED';
          }
          break;

        case 'HUMAN_TASK':
          message = `[Simulação] Criaria tarefa humana "${config.title || 'Sem título'}" atribuída a "${config.responsible?.type || 'Sem responsável'}".`;
          break;

        case 'APPROVAL':
          message = `[Simulação] Solicitaria aprovação do tipo "${config.approvalType || 'SIMPLE'}" para "${config.approver?.type || 'Sem aprovador'}".`;
          break;

        case 'TIMER':
          message = `[Simulação] Aguardaria atraso de ${config.delayAmount || 0} ${config.delayUnit || 'MINUTOS'}.`;
          break;

        case 'ACTION':
          message = `[Simulação] Executaria ação automática [${node.blockType}]: "${config.title || 'Sem título'}"`;
          break;

        case 'INTEGRATION':
          message = `[Simulação] Chamaria conector [${node.blockType}].`;
          break;
      }

      // Merge trace output
      Object.assign(context, nodeOutput);

      steps.push({
        nodeKey: id,
        nodeType: type,
        name,
        status: stepStatus,
        message,
        outputVariables: { ...nodeOutput },
      });

      executed.add(id);

      // Add children to queue
      const neighbors = adjacencyList.get(id) || [];
      for (const edge of neighbors) {
        let shouldFollow = true;

        if (edge.sourceHandle === 'true' || edge.sourceHandle === 'false') {
          const branch = edge.sourceHandle === 'true';
          shouldFollow = nodeOutput.result === branch;
        }

        if (shouldFollow) {
          queue.push({
            nodeId: edge.target || edge.targetNodeKey,
            incomingVariables: { ...context },
            sourceHandle: edge.sourceHandle,
          });
        } else {
          // Record skipped path log
          const skippedNode = nodeMap.get(edge.target || edge.targetNodeKey);
          if (skippedNode) {
            steps.push({
              nodeKey: skippedNode.id || skippedNode.nodeKey,
              nodeType: skippedNode.type || skippedNode.nodeType,
              name: skippedNode.data?.label || skippedNode.name,
              status: 'SKIPPED',
              message: `Caminho ignorado pela condição lógica.`,
              outputVariables: {},
            });
          }
        }
      }
    }

    return {
      steps,
      finalContext: context,
    };
  }
}
