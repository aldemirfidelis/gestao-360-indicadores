import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Vision360Service } from './vision360.service';
import { NotFoundException } from '@nestjs/common';

describe('Vision360Service - Visão 360° e Análise de Impacto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeService(prismaMock: any) {
    return new Vision360Service(prismaMock as any);
  }

  describe('addLink (Cadastro de Vínculos Manuais)', () => {
    it('deve criar um vínculo novo se não existir duplicata', async () => {
      const prisma = {
        relationshipLink: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'link-123' }),
        },
        relationshipAuditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      };

      const service = makeService(prisma);
      const dto = {
        sourceEntityType: 'INDICATOR',
        sourceEntityId: 'ind-1',
        targetEntityType: 'PROCESS',
        targetEntityId: 'proc-1',
        relationshipType: 'pertence_a',
        criticality: 'HIGH',
        isMandatory: false,
        notes: 'Teste',
      };

      const result = await service.addLink('company-1', 'user-1', dto);

      expect(prisma.relationshipLink.findFirst).toHaveBeenCalled();
      expect(prisma.relationshipLink.create).toHaveBeenCalledWith({
        data: {
          companyId: 'company-1',
          sourceEntityType: 'INDICATOR',
          sourceEntityId: 'ind-1',
          targetEntityType: 'PROCESS',
          targetEntityId: 'proc-1',
          relationshipType: 'pertence_a',
          criticality: 'HIGH',
          isMandatory: false,
          originType: 'MANUAL',
          notes: 'Teste',
          createdById: 'user-1',
        },
      });
      expect(prisma.relationshipAuditLog.create).toHaveBeenCalled();
      expect(result.id).toBe('link-123');
    });

    it('deve lançar erro se já existir um vínculo (evitando duplicações ou loops de 1 nível)', async () => {
      const prisma = {
        relationshipLink: {
          findFirst: vi.fn().mockResolvedValue({ id: 'existing-link' }),
        },
      };

      const service = makeService(prisma);
      const dto = {
        sourceEntityType: 'INDICATOR',
        sourceEntityId: 'ind-1',
        targetEntityType: 'PROCESS',
        targetEntityId: 'proc-1',
        relationshipType: 'pertence_a',
        criticality: 'HIGH',
        isMandatory: false,
      };

      await expect(
        service.addLink('company-1', 'user-1', dto),
      ).rejects.toThrow('Já existe um relacionamento entre estes registros.');
    });
  });

  describe('removeLink', () => {
    it('deve arquivar (exclusão lógica) um vínculo existente', async () => {
      const prisma = {
        relationshipLink: {
          findFirst: vi.fn().mockResolvedValue({ id: 'link-123', sourceEntityType: 'INDICATOR', sourceEntityId: 'ind-1', targetEntityType: 'PROCESS', targetEntityId: 'proc-1' }),
          update: vi.fn().mockResolvedValue({ id: 'link-123', deletedAt: new Date() }),
        },
        relationshipAuditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      };

      const service = makeService(prisma);
      const result = await service.removeLink('company-1', 'user-1', 'link-123');

      expect(prisma.relationshipLink.findFirst).toHaveBeenCalled();
      expect(prisma.relationshipLink.update).toHaveBeenCalled();
      expect(prisma.relationshipAuditLog.create).toHaveBeenCalled();
      expect(result.id).toBe('link-123');
    });

    it('deve lançar NotFound se o vínculo não for encontrado ou for de outro tenant', async () => {
      const prisma = {
        relationshipLink: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };

      const service = makeService(prisma);
      await expect(
        service.removeLink('company-1', 'user-1', 'link-123'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('simulateImpact (BFS com profundidade limitada e prevenção de loops)', () => {
    it('deve propagar impacto até profundidade 3 sem entrar em loop infinito', async () => {
      const prisma = {
        indicator: {
          findFirst: vi.fn().mockImplementation(({ where }) => {
            if (where.id === 'ind-A') return Promise.resolve({ id: 'ind-A', name: 'Ind A', code: 'A', status: 'ACTIVE', responsibleUserId: 'u1', ownerNode: null, responsibleUser: null });
            if (where.id === 'ind-B') return Promise.resolve({ id: 'ind-B', name: 'Ind B', code: 'B', status: 'ACTIVE', responsibleUserId: 'u1', ownerNode: null, responsibleUser: null });
            if (where.id === 'ind-C') return Promise.resolve({ id: 'ind-C', name: 'Ind C', code: 'C', status: 'ACTIVE', responsibleUserId: 'u1', ownerNode: null, responsibleUser: null });
            return Promise.resolve(null);
          }),
        },
        actionPlan: { findMany: vi.fn().mockResolvedValue([]) },
        deviation: { findMany: vi.fn().mockResolvedValue([]) },
        meeting: { findMany: vi.fn().mockResolvedValue([]) },
        process: { findMany: vi.fn().mockResolvedValue([]) },
        relationshipLink: {
          findMany: vi.fn().mockImplementation(({ where }) => {
            if (where.OR[0].sourceEntityId === 'ind-A') {
              return Promise.resolve([
                {
                  id: 'link-AB',
                  sourceEntityType: 'INDICATOR',
                  sourceEntityId: 'ind-A',
                  targetEntityType: 'INDICATOR',
                  targetEntityId: 'ind-B',
                  relationshipType: 'pertence_a',
                  criticality: 'HIGH',
                  isMandatory: true,
                },
              ]);
            }
            if (where.OR[0].sourceEntityId === 'ind-B') {
              return Promise.resolve([
                {
                  id: 'link-BC',
                  sourceEntityType: 'INDICATOR',
                  sourceEntityId: 'ind-B',
                  targetEntityType: 'INDICATOR',
                  targetEntityId: 'ind-C',
                  relationshipType: 'pertence_a',
                  criticality: 'MEDIUM',
                  isMandatory: false,
                },
              ]);
            }
            if (where.OR[0].sourceEntityId === 'ind-C') {
              return Promise.resolve([
                {
                  id: 'link-CA',
                  sourceEntityType: 'INDICATOR',
                  sourceEntityId: 'ind-C',
                  targetEntityType: 'INDICATOR',
                  targetEntityId: 'ind-A',
                  relationshipType: 'pertence_a',
                  criticality: 'LOW',
                  isMandatory: false,
                },
              ]);
            }
            return Promise.resolve([]);
          }),
        },
      };

      const service = makeService(prisma);
      const impacts = await service.simulateImpact('company-1', 'INDICATOR', 'ind-A', 3);

      expect(impacts.length).toBe(2);
      expect(impacts[0].affectedEntityId).toBe('ind-B');
      expect(impacts[1].affectedEntityId).toBe('ind-C');
    });
  });

  describe('saveImpactAnalysis', () => {
    it('deve salvar a análise e gerar tarefas/plano de ação e notificações se configurado', async () => {
      const prisma = {
        impactAnalysis: {
          create: vi.fn().mockResolvedValue({ id: 'analysis-123' }),
        },
        impactAnalysisItem: {
          create: vi.fn().mockResolvedValue({ id: 'item-123' }),
        },
        actionPlan: {
          create: vi.fn().mockResolvedValue({ id: 'task-123' }),
        },
        notification: {
          create: vi.fn().mockResolvedValue({ id: 'notif-123' }),
        },
      };

      const service = makeService(prisma);
      const dto = {
        sourceEntityType: 'INDICATOR',
        sourceEntityId: 'ind-1',
        operationType: 'UPDATE',
        changeSummary: 'Edição cadastral',
        impactLevel: 'HIGH',
        justification: 'Alteração estratégica',
        affectedItems: [
          {
            affectedEntityType: 'PROCESS',
            affectedEntityId: 'proc-1',
            relationshipPath: 'INDICATOR ➔ PROCESS',
            impactReason: 'Vínculo via processo',
            impactLevel: 'CRITICAL',
            recommendedAction: 'Ajustar no fluxo',
            requiresReview: true,
            requiresTask: true,
            responsibleUserId: 'user-resp-1',
            dueDate: '2026-06-15',
          },
        ],
      };

      const result = await service.saveImpactAnalysis('company-1', 'user-1', dto);

      expect(prisma.impactAnalysis.create).toHaveBeenCalled();
      expect(prisma.impactAnalysisItem.create).toHaveBeenCalled();
      expect(prisma.actionPlan.create).toHaveBeenCalled();
      expect(prisma.notification.create).toHaveBeenCalled();
      expect(result.id).toBe('analysis-123');
    });
  });
});
