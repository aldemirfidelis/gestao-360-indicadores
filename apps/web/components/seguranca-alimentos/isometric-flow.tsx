'use client';

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera, OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Boxes, ChevronRight, Focus, Library, Plus, Save, Sparkles, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react';
import {
  FLOW_TEMPLATES,
  IndustrialStepModel,
  VISUAL_MODEL_DEFINITIONS,
  getVisualModelDefinition,
  resolveVisualModel,
  type FlowTemplate,
  type FlowTemplateStep,
  type StepCategory,
  type VisualModelId,
} from './isometric-library';

// Tipagem das etapas para o fluxo 3D
export interface IsometricStep {
  id: string;
  number: number;
  name: string;
  description?: string | null;
  inputs?: string | null;
  outputs?: string | null;
  type: StepCategory;
  visualModel?: string | null;
  positionX: number | null;
  positionY: number | null;
  isControlPoint: boolean;
}

interface IsometricFlowProps {
  steps: IsometricStep[];
  canManage: boolean;
  onStepMove: (id: string, x: number, y: number) => void;
  onStepsArrange: (positions: Array<{ id: string; positionX: number; positionY: number }>) => void;
  onStepCreate: (data: {
    name: string;
    description?: string;
    type: IsometricStep['type'];
    visualModel: VisualModelId;
    isControlPoint: boolean;
  }) => void;
  onTemplateApply: (steps: FlowTemplateStep[]) => void;
  onStepDelete: (id: string) => void;
  onStepUpdate: (id: string, data: {
    number?: number;
    name?: string;
    description?: string | null;
    inputs?: string | null;
    outputs?: string | null;
    type?: string;
    visualModel?: string | null;
    isControlPoint?: boolean;
  }) => void;
  /** Modelos de fluxo persistidos da empresa (aparecem junto à biblioteca padrão). */
  companyTemplates?: CompanyFlowTemplate[];
  /** Salva o fluxo atual do processo como modelo da empresa. */
  onTemplateSave?: (payload: { name: string }) => void;
  onTemplateDelete?: (id: string) => void;
  onTemplateExport?: (template: CompanyFlowTemplate) => void;
  /** Importa um modelo a partir de JSON exportado. */
  onTemplateImport?: (payload: { name: string; sector?: string | null; summary?: string | null; color?: string | null; steps: FlowTemplateStep[] }) => void;
}

export interface CompanyFlowTemplate extends FlowTemplate {
  /** id persistido no servidor (para excluir/exportar). */
  persistedId: string;
}

const DEFAULT_ZOOM = 55;
const MIN_ZOOM = 12;
const MAX_ZOOM = 90;
const GRID_LIMIT = 15;
const API_POSITION_SCALE = 100;

type PositionedStep = IsometricStep & {
  positionX: number;
  positionY: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function createAutomaticLayout(steps: IsometricStep[]): PositionedStep[] {
  const sorted = [...steps].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  if (sorted.length === 0) return [];

  const columns = Math.min(4, Math.ceil(Math.sqrt(sorted.length * 1.5)));
  const rows = Math.ceil(sorted.length / columns);
  const spacingX = 360;
  const spacingY = 330;

  return sorted.map((step, index) => {
    const row = Math.floor(index / columns);
    const indexInRow = index % columns;
    const itemsInRow = Math.min(columns, sorted.length - row * columns);
    const column = row % 2 === 0 ? indexInRow : itemsInRow - 1 - indexInRow;

    return {
      ...step,
      positionX: Math.round((column - (itemsInRow - 1) / 2) * spacingX),
      positionY: Math.round((row - (rows - 1) / 2) * spacingY),
    };
  });
}

function positionSteps(steps: IsometricStep[]): PositionedStep[] {
  const automatic = createAutomaticLayout(steps);
  const originalById = new Map(steps.map((step) => [step.id, step]));

  return automatic.map((fallback) => {
    const original = originalById.get(fallback.id);
    const positionX = typeof original?.positionX === 'number' && Number.isFinite(original.positionX)
      ? original.positionX
      : fallback.positionX;
    const positionY = typeof original?.positionY === 'number' && Number.isFinite(original.positionY)
      ? original.positionY
      : fallback.positionY;

    return {
      ...fallback,
      positionX: clamp(positionX, -GRID_LIMIT * API_POSITION_SCALE, GRID_LIMIT * API_POSITION_SCALE),
      positionY: clamp(positionY, -GRID_LIMIT * API_POSITION_SCALE, GRID_LIMIT * API_POSITION_SCALE),
    };
  });
}

// ----------------------------------------------------------------------
// 1. Modelos 3D Low-Poly feitos com Primitivas
// ----------------------------------------------------------------------

// Indicador PCC (Ponto Crítico de Controle)
function PCCBeacon({ active }: { active: boolean }) {
  const beaconRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (!beaconRef.current) return;
    // Rotação da sirene
    beaconRef.current.rotation.y += 0.04;
    // Pulsação suave na escala
    const scale = 1 + Math.sin(state.clock.getElapsedTime() * 5) * 0.08;
    beaconRef.current.scale.set(scale, scale, scale);
  });

  if (!active) return null;

  return (
    <group position={[0, 1.8, 0]}>
      {/* Luz Emissiva de Sirene */}
      <mesh ref={beaconRef}>
        <cylinderGeometry args={[0.15, 0.2, 0.3, 8]} />
        <meshStandardMaterial 
          color="#ef4444" 
          emissive="#ef4444" 
          emissiveIntensity={1.8} 
          roughness={0.1}
        />
      </mesh>
      {/* Halo de aviso flutuante */}
      <mesh position={[0, 0.3, 0]}>
        <dodecahedronGeometry args={[0.08, 0]} />
        <meshStandardMaterial 
          color="#f43f5e" 
          emissive="#f43f5e" 
          emissiveIntensity={2.5}
        />
      </mesh>
      {/* Pequena luz de ponto real no Three.js */}
      <pointLight color="#f43f5e" intensity={1.5} distance={3} />
    </group>
  );
}

// RECEIVING (Doca / Recepção)
function ModelReceiving() {
  return (
    <group>
      {/* Plataforma cinza */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[1.5, 0.2, 1.5]} />
        <meshStandardMaterial color="#64748b" roughness={0.8} />
      </mesh>
      {/* Portão da Doca */}
      <mesh position={[0, 0.6, -0.5]}>
        <boxGeometry args={[1.1, 0.8, 0.2]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Caixas de carga */}
      <mesh position={[-0.3, 0.35, 0.2]} rotation={[0, 0.2, 0]}>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshStandardMaterial color="#d97706" roughness={0.9} />
      </mesh>
      <mesh position={[0.2, 0.3, 0.3]} rotation={[0, -0.4, 0]}>
        <boxGeometry args={[0.35, 0.3, 0.35]} />
        <meshStandardMaterial color="#b45309" roughness={0.9} />
      </mesh>
    </group>
  );
}

// STORAGE (Silo de Grãos / Armazenamento)
function ModelStorage() {
  return (
    <group>
      {/* Base metálica / Pernas de suporte */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[1.2, 0.3, 1.2]} />
        <meshStandardMaterial color="#475569" metalness={0.8} />
      </mesh>
      {/* Pernas do silo */}
      {[-0.45, 0.45].map((x) =>
        [-0.45, 0.45].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.35, z]}>
            <cylinderGeometry args={[0.04, 0.04, 0.4, 6]} />
            <meshStandardMaterial color="#334155" metalness={0.9} />
          </mesh>
        ))
      )}
      {/* Corpo principal do silo */}
      <mesh position={[0, 1.0, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 1.0, 12]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.2} />
      </mesh>
      {/* Cone superior */}
      <mesh position={[0, 1.65, 0]}>
        <coneGeometry args={[0.52, 0.3, 12]} />
        <meshStandardMaterial color="#0284c7" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Escada externa cilíndrica vertical */}
      <mesh position={[0.5, 1.0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1.0, 4]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
    </group>
  );
}

// PROCESSING (Fábrica / Processamento)
function ModelProcessing() {
  return (
    <group>
      {/* Prédio principal */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[1.6, 0.8, 1.2]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.7} />
      </mesh>
      {/* Telhado dente de serra industrial */}
      {[-0.4, 0.4].map((x) => (
        <mesh key={x} position={[x, 0.9, 0]} rotation={[0, 0, -Math.PI / 6]}>
          <boxGeometry args={[0.8, 0.2, 1.25]} />
          <meshStandardMaterial color="#dc2626" roughness={0.5} />
        </mesh>
      ))}
      {/* Chaminé */}
      <mesh position={[-0.5, 1.1, -0.3]}>
        <cylinderGeometry args={[0.1, 0.12, 0.7, 8]} />
        <meshStandardMaterial color="#475569" roughness={0.8} />
      </mesh>
      {/* Fumaça estilizada low-poly */}
      <mesh position={[-0.5, 1.6, -0.3]}>
        <sphereGeometry args={[0.15, 6, 6]} />
        <meshStandardMaterial color="white" opacity={0.65} transparent flatShading />
      </mesh>
    </group>
  );
}

// PACKAGING (Embalagem / Linha de Envase)
function ModelPackaging() {
  return (
    <group>
      {/* Mesa da Esteira */}
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[1.6, 0.5, 0.6]} />
        <meshStandardMaterial color="#334155" roughness={0.7} />
      </mesh>
      {/* Tapete da esteira */}
      <mesh position={[0, 0.51, 0]}>
        <boxGeometry args={[1.5, 0.02, 0.5]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>
      {/* Máquina de selagem/embalagem */}
      <mesh position={[-0.2, 0.8, 0]}>
        <boxGeometry args={[0.5, 0.6, 0.7]} />
        <meshStandardMaterial color="#0d9488" metalness={0.5} roughness={0.3} />
      </mesh>
      {/* Tela de status / Painel */}
      <mesh position={[-0.25, 1.0, 0.36]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.2, 0.15, 0.05]} />
        <meshStandardMaterial color="#14b8a6" emissive="#14b8a6" emissiveIntensity={0.8} />
      </mesh>
      {/* Caixa de papelão saindo na esteira */}
      <mesh position={[0.4, 0.6, 0]} rotation={[0, 0.2, 0]}>
        <boxGeometry args={[0.3, 0.2, 0.3]} />
        <meshStandardMaterial color="#ca8a04" roughness={0.9} />
      </mesh>
    </group>
  );
}

// TRANSPORT (Expedição / Caminhão / Trator)
function ModelTransport() {
  const wheels = [
    [-0.5, -0.2], [0.4, -0.2],
    [-0.5, 0.2], [0.4, 0.2]
  ];
  return (
    <group position={[0, 0.3, 0]}>
      {/* Rodas */}
      {wheels.map(([x, z], i) => (
        <mesh key={i} position={[x, -0.15, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.15, 8]} />
          <meshStandardMaterial color="#1e293b" roughness={0.9} />
        </mesh>
      ))}
      {/* Chassi do caminhão */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1.4, 0.15, 0.6]} />
        <meshStandardMaterial color="#475569" metalness={0.7} />
      </mesh>
      {/* Cabine */}
      <mesh position={[0.45, 0.25, 0]}>
        <boxGeometry args={[0.4, 0.4, 0.55]} />
        <meshStandardMaterial color="#2563eb" roughness={0.5} />
      </mesh>
      {/* Vidro da Cabine */}
      <mesh position={[0.55, 0.35, 0]}>
        <boxGeometry args={[0.22, 0.18, 0.48]} />
        <meshStandardMaterial color="#93c5fd" opacity={0.8} transparent roughness={0.1} />
      </mesh>
      {/* Carroceria / Carga */}
      <mesh position={[-0.2, 0.35, 0]}>
        <boxGeometry args={[0.85, 0.6, 0.58]} />
        <meshStandardMaterial color="#f97316" roughness={0.6} />
      </mesh>
    </group>
  );
}

// DISTRIBUTION (Mercado / Ponto de Venda)
function ModelDistribution() {
  return (
    <group>
      {/* Prédio principal da loja */}
      <mesh position={[0, 0.4, -0.2]}>
        <boxGeometry args={[1.5, 0.8, 1.0]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.6} />
      </mesh>
      {/* Telhado plano */}
      <mesh position={[0, 0.82, -0.2]}>
        <boxGeometry args={[1.6, 0.05, 1.1]} />
        <meshStandardMaterial color="#475569" roughness={0.4} />
      </mesh>
      {/* Toldo listrado (Awnings) */}
      <mesh position={[0, 0.65, 0.35]} rotation={[0.4, 0, 0]}>
        <boxGeometry args={[1.45, 0.08, 0.4]} />
        <meshStandardMaterial color="#ea580c" roughness={0.8} />
      </mesh>
      {/* Entrada / Vidro frontal */}
      <mesh position={[0, 0.3, 0.31]}>
        <boxGeometry args={[1.0, 0.6, 0.02]} />
        <meshStandardMaterial color="#cbd5e1" opacity={0.6} transparent roughness={0.1} />
      </mesh>
      {/* Porta */}
      <mesh position={[0.2, 0.25, 0.32]}>
        <boxGeometry args={[0.35, 0.5, 0.02]} />
        <meshStandardMaterial color="#334155" metalness={0.5} />
      </mesh>
    </group>
  );
}

// OTHER (Outros Processos / Pedestal / Cristal)
function ModelOther() {
  const crystalRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (crystalRef.current) {
      crystalRef.current.rotation.y += 0.015;
    }
  });
  return (
    <group>
      {/* Pedestal */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.45, 0.55, 0.4, 8]} />
        <meshStandardMaterial color="#475569" roughness={0.8} />
      </mesh>
      {/* Cristal flutuante que rotaciona */}
      <mesh ref={crystalRef} position={[0, 0.9, 0]}>
        <octahedronGeometry args={[0.3, 0]} />
        <meshStandardMaterial 
          color="#a855f7" 
          emissive="#6b21a8" 
          emissiveIntensity={0.6}
          metalness={0.9} 
          roughness={0.1} 
        />
      </mesh>
    </group>
  );
}

// ----------------------------------------------------------------------
// 2. Elemento do Bloco da Etapa (Render + Arraste)
// ----------------------------------------------------------------------

interface StepBlockProps {
  step: IsometricStep;
  canManage: boolean;
  selected: boolean;
  onClick: () => void;
  onMove: (id: string, x: number, z: number) => void;
}

function StepBlock({ step, canManage, selected, onClick, onMove }: StepBlockProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const dragOffset = useRef(new THREE.Vector3());
  const dragStart = useRef(new THREE.Vector3());
  // OrbitControls padrão (makeDefault). Durante o arraste do bloco eles
  // PRECISAM ser desligados: como o botão esquerdo também é PAN da câmera, o
  // mundo se movia junto com o mouse e o bloco parecia travado — era o bug
  // relatado de "não consigo arrastar a etapa".
  const controls = useThree((state) => state.controls) as unknown as { enabled: boolean } | null;

  // Cursor coerente com a interação (agarrar/agarrando).
  useEffect(() => {
    if (!canManage) return;
    document.body.style.cursor = dragging ? 'grabbing' : hovered ? 'grab' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hovered, dragging, canManage]);

  // Coordenadas 3D iniciais: convertemos positionX/positionY salvos na escala React Flow
  const initialX = typeof step.positionX === 'number' && !isNaN(step.positionX) ? step.positionX / 100 : 0;
  const initialZ = typeof step.positionY === 'number' && !isNaN(step.positionY) ? step.positionY / 100 : 0;

  useEffect(() => {
    if (groupRef.current && !dragging) {
      groupRef.current.position.set(initialX, 0, initialZ);
    }
  }, [initialX, initialZ, dragging]);

  // Compatibilidade explícita para fluxos antigos que tenham solicitado o modelo legado.
  const renderLegacyModel = () => {
    switch (step.type) {
      case 'RECEIVING': return <ModelReceiving />;
      case 'STORAGE': return <ModelStorage />;
      case 'PROCESSING': return <ModelProcessing />;
      case 'PACKAGING': return <ModelPackaging />;
      case 'TRANSPORT': return <ModelTransport />;
      case 'DISTRIBUTION': return <ModelDistribution />;
      default: return <ModelOther />;
    }
  };
  const modelDefinition = getVisualModelDefinition(step.visualModel, step.type);

  // Lógica do Drag-and-Drop 3D com Raycasting no plano XZ (y=0)
  const handlePointerDown = (e: any) => {
    if (!canManage) return;
    e.stopPropagation();

    // Captura no ALVO do R3F (não no canvas do DOM): é o que garante que os
    // eventos de movimento continuem chegando ao bloco mesmo quando o ponteiro
    // sai da malha durante um arraste rápido.
    e.target?.setPointerCapture?.(e.pointerId);
    // Desliga a câmera enquanto arrasta o bloco (senão o PAN anda junto).
    if (controls) controls.enabled = false;
    setDragging(true);

    const intersection = new THREE.Vector3();
    // Interseção do raio da câmera com o plano Y = 0
    e.raycaster.ray.intersectPlane(planeRef.current, intersection);

    if (groupRef.current) {
      dragStart.current.copy(groupRef.current.position);
      dragOffset.current.copy(groupRef.current.position).sub(intersection);
    }
  };

  const handlePointerMove = (e: any) => {
    if (!dragging || !groupRef.current) return;
    e.stopPropagation();

    const intersection = new THREE.Vector3();
    e.raycaster.ray.intersectPlane(planeRef.current, intersection);

    const newPos = intersection.add(dragOffset.current);
    
    // Grid Snapping (arredondar para múltiplos de 0.5 unidades)
    const snapX = Math.round(newPos.x * 2) / 2;
    const snapZ = Math.round(newPos.z * 2) / 2;

    // Limites da grade
    groupRef.current.position.set(
      Math.max(-15, Math.min(15, snapX)), 
      0, 
      Math.max(-15, Math.min(15, snapZ))
    );
  };

  const handlePointerUp = (e: any) => {
    if (!dragging) return;
    e.stopPropagation();
    e.target?.releasePointerCapture?.(e.pointerId);
    if (controls) controls.enabled = true;
    setDragging(false);

    if (groupRef.current) {
      const finalX = Math.round(groupRef.current.position.x * 100);
      const finalZ = Math.round(groupRef.current.position.z * 100);
      const moved = groupRef.current.position.distanceToSquared(dragStart.current) > 0.01;
      // Um clique abre o inspetor; um arraste persiste a nova posição.
      if (!moved) {
        onClick();
      } else if (finalX !== step.positionX || finalZ !== step.positionY) {
        onMove(step.id, finalX, finalZ);
      }
    }
  };

  // Rede de segurança: se o navegador cancelar o gesto (perda de captura,
  // alt-tab, toque interrompido), o arraste termina e a câmera volta a operar.
  const handlePointerCancel = () => {
    if (!dragging) return;
    if (controls) controls.enabled = true;
    setDragging(false);
  };

  return (
    <group
      ref={groupRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handlePointerCancel}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
    >
      {/* Base técnica da estação: dá escala e separa visualmente cada etapa. */}
      <mesh position={[0, 0.025, 0]} receiveShadow>
        <boxGeometry args={[2.25, 0.05, 1.95]} />
        <meshStandardMaterial color={modelDefinition.color} opacity={0.1} transparent roughness={0.92} />
      </mesh>
      <mesh position={[0, 0.053, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.08, 1.12, 40]} />
        <meshBasicMaterial color={modelDefinition.color} transparent opacity={0.42} />
      </mesh>

      {/* Modelo Visual */}
      {step.visualModel === 'LEGACY'
        ? renderLegacyModel()
        : <IndustrialStepModel visualModel={step.visualModel} category={step.type} />}

      {/* Farol PCC */}
      <PCCBeacon active={step.isControlPoint} />

      {/* Realce da etapa selecionada */}
      {selected && (
        <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.02, 1.18, 32]} />
          <meshBasicMaterial color="#0ea5e9" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Placa com nome flutuante */}
      <Html position={[0, 2.18, 0]} center zIndexRange={[20, 0]}>
        <div 
          data-testid="flow-step-label"
          onClick={(e) => {
            e.stopPropagation();
            if (!dragging) onClick();
          }}
          className={`max-w-44 cursor-pointer select-none rounded-md border px-2 py-1 shadow-md backdrop-blur-sm transition-all duration-200 ${
            step.isControlPoint 
              ? 'border-red-400 bg-red-50/95 text-red-700 hover:bg-red-100'
              : 'border-slate-200 bg-white/90 text-slate-700 hover:bg-slate-50'
          } ${
            hovered || dragging || selected 
              ? 'scale-105 ring-2 ring-sky-500 opacity-100 pointer-events-auto' 
              : 'opacity-0 scale-95 pointer-events-none'
          }`}
        >
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-[9px] font-bold opacity-60">#{step.number}</span>
            <span className="max-w-32 truncate text-[10px] font-semibold">{step.name}</span>
          </div>
          {(hovered || dragging || selected) && (
            <div className="mt-0.5 max-w-36 truncate text-[8px] font-medium opacity-65">
              {modelDefinition.label}
            </div>
          )}
        </div>
      </Html>

      {/* Caixa invisível maior para facilitar click e drag */}
      <mesh position={[0, 0.7, 0]} visible={false}>
        <boxGeometry args={[2.2, 1.8, 1.9]} />
        <meshBasicMaterial transparent opacity={0.1} />
      </mesh>
    </group>
  );
}

// ----------------------------------------------------------------------
// 3. Setas Tridimensionais Conectoras de Fluxo
// ----------------------------------------------------------------------

interface StepConnectionProps {
  fromStep: IsometricStep;
  toStep: IsometricStep;
}

function StepConnection({ fromStep, toStep }: StepConnectionProps) {
  const particleRef = useRef<THREE.Mesh>(null);
  const fromX = typeof fromStep.positionX === 'number' && !isNaN(fromStep.positionX) ? fromStep.positionX / 100 : 0;
  const fromZ = typeof fromStep.positionY === 'number' && !isNaN(fromStep.positionY) ? fromStep.positionY / 100 : 0;
  const toX = typeof toStep.positionX === 'number' && !isNaN(toStep.positionX) ? toStep.positionX / 100 : 0;
  const toZ = typeof toStep.positionY === 'number' && !isNaN(toStep.positionY) ? toStep.positionY / 100 : 0;

  const connection = useMemo(() => {
    const start = new THREE.Vector3(fromX, 0.13, fromZ);
    const end = new THREE.Vector3(toX, 0.13, toZ);
    const distance = start.distanceTo(end);
    const direction = new THREE.Vector3().subVectors(end, start).normalize();
    const controlA = start.clone().add(direction.clone().multiplyScalar(Math.min(0.8, distance * 0.25)));
    const controlB = end.clone().sub(direction.clone().multiplyScalar(Math.min(0.8, distance * 0.25)));
    controlA.y = 0.24;
    controlB.y = 0.24;
    return {
      start,
      end,
      distance,
      direction,
      curve: new THREE.CatmullRomCurve3([start, controlA, controlB, end]),
    };
  }, [fromX, fromZ, toX, toZ]);
  const { curve, direction, distance, end } = connection;
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction),
    [direction],
  );

  useFrame((state) => {
    if (!particleRef.current || distance < 0.6) return;
    const progress = (state.clock.getElapsedTime() * 0.22 + fromStep.number * 0.07) % 1;
    particleRef.current.position.copy(curve.getPoint(progress));
  });

  if (distance < 0.6) return null;

  return (
    <group>
      {/* Linha elevada evita atravessar as bases e acompanha mudanças de posição. */}
      <mesh castShadow>
        <tubeGeometry args={[curve, 28, 0.045, 8, false]} />
        <meshStandardMaterial 
          color="#0284c7" 
          emissive="#0284c7" 
          emissiveIntensity={0.2}
          roughness={0.2} 
        />
      </mesh>
      <mesh ref={particleRef}>
        <sphereGeometry args={[0.085, 10, 8]} />
        <meshStandardMaterial color="#67e8f9" emissive="#0891b2" emissiveIntensity={1.2} />
      </mesh>
      {/* Seta no final da conexão */}
      <mesh position={end.clone().sub(direction.clone().multiplyScalar(0.25))} quaternion={quaternion}>
        <coneGeometry args={[0.12, 0.25, 6]} />
        <meshStandardMaterial 
          color="#0ea5e9" 
          emissive="#0ea5e9" 
          emissiveIntensity={0.5} 
        />
      </mesh>
    </group>
  );
}

interface FlowCameraHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
}

interface FlowCameraControlsProps {
  positions: Array<{ x: number; z: number }>;
  fitKey: string;
}

const FlowCameraControls = forwardRef<FlowCameraHandle, FlowCameraControlsProps>(
  function FlowCameraControls({ positions, fitKey }, ref) {
    const { camera, size, invalidate } = useThree();
    const controlsRef = useRef<React.ElementRef<typeof OrbitControls>>(null);
    const positionsRef = useRef(positions);
    positionsRef.current = positions;

    const setZoom = useCallback((nextZoom: number) => {
      const orthographic = camera as THREE.OrthographicCamera;
      orthographic.zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
      orthographic.updateProjectionMatrix();
      controlsRef.current?.update();
      invalidate();
    }, [camera, invalidate]);

    const fit = useCallback(() => {
      const orthographic = camera as THREE.OrthographicCamera;
      const currentPositions = positionsRef.current;
      const xValues = currentPositions.map((position) => position.x);
      const zValues = currentPositions.map((position) => position.z);
      const minX = currentPositions.length ? Math.min(...xValues) - 1.7 : -4;
      const maxX = currentPositions.length ? Math.max(...xValues) + 1.7 : 4;
      const minZ = currentPositions.length ? Math.min(...zValues) - 1.7 : -4;
      const maxZ = currentPositions.length ? Math.max(...zValues) + 1.7 : 4;
      const center = new THREE.Vector3((minX + maxX) / 2, 0.7, (minZ + maxZ) / 2);

      orthographic.position.copy(center).add(new THREE.Vector3(16, 16, 16));
      orthographic.up.set(0, 1, 0);
      controlsRef.current?.target.copy(center);
      controlsRef.current?.update();
      orthographic.updateMatrixWorld(true);

      const box = new THREE.Box3(
        new THREE.Vector3(minX, 0, minZ),
        new THREE.Vector3(maxX, 3, maxZ),
      );
      const corners = [
        new THREE.Vector3(box.min.x, box.min.y, box.min.z),
        new THREE.Vector3(box.min.x, box.min.y, box.max.z),
        new THREE.Vector3(box.min.x, box.max.y, box.min.z),
        new THREE.Vector3(box.min.x, box.max.y, box.max.z),
        new THREE.Vector3(box.max.x, box.min.y, box.min.z),
        new THREE.Vector3(box.max.x, box.min.y, box.max.z),
        new THREE.Vector3(box.max.x, box.max.y, box.min.z),
        new THREE.Vector3(box.max.x, box.max.y, box.max.z),
      ].map((corner) => corner.applyMatrix4(orthographic.matrixWorldInverse));

      const viewX = corners.map((corner) => corner.x);
      const viewY = corners.map((corner) => corner.y);
      const contentWidth = Math.max(...viewX) - Math.min(...viewX);
      const contentHeight = Math.max(...viewY) - Math.min(...viewY);
      const fittedZoom = Math.min(
        size.width / Math.max(contentWidth * 1.3, 1),
        size.height / Math.max(contentHeight * 1.35, 1),
        DEFAULT_ZOOM,
      );

      setZoom(fittedZoom);
      controlsRef.current?.saveState();
    }, [camera, setZoom, size.height, size.width]);

    useImperativeHandle(ref, () => ({
      zoomIn: () => setZoom((camera as THREE.OrthographicCamera).zoom * 1.2),
      zoomOut: () => setZoom((camera as THREE.OrthographicCamera).zoom / 1.2),
      fit,
    }), [camera, fit, setZoom]);

    useEffect(() => {
      const frame = window.requestAnimationFrame(fit);
      return () => window.cancelAnimationFrame(frame);
    }, [fit, fitKey]);

    return (
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableRotate
        enablePan
        enableZoom
        enableDamping
        dampingFactor={0.08}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        zoomSpeed={0.8}
        zoomToCursor
        screenSpacePanning
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.1}
        mouseButtons={{
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE,
        }}
        touches={{
          ONE: THREE.TOUCH.PAN,
          TWO: THREE.TOUCH.DOLLY_ROTATE,
        }}
      />
    );
  },
);

const STEP_TYPE_OPTIONS: Array<{ value: IsometricStep['type']; label: string }> = [
  { value: 'RECEIVING', label: 'Doca / Recebimento' },
  { value: 'STORAGE', label: 'Silo / Armazenamento' },
  { value: 'PROCESSING', label: 'Indústria / Processamento' },
  { value: 'PACKAGING', label: 'Envase / Embalagem' },
  { value: 'TRANSPORT', label: 'Caminhão / Transporte' },
  { value: 'DISTRIBUTION', label: 'Loja / Distribuição' },
  { value: 'OTHER', label: 'Outro processo' },
];

const VISUAL_MODEL_GROUPS = VISUAL_MODEL_DEFINITIONS.reduce<Array<{
  label: string;
  options: typeof VISUAL_MODEL_DEFINITIONS;
}>>((groups, option) => {
  const group = groups.find((item) => item.label === option.group);
  if (group) group.options.push(option);
  else groups.push({ label: option.group, options: [option] });
  return groups;
}, []);

function StepInspector({
  step,
  canManage,
  onClose,
  onDelete,
  onUpdate,
}: {
  step: IsometricStep;
  canManage: boolean;
  onClose: () => void;
  onDelete: () => void;
  onUpdate: (data: {
    number: number;
    name: string;
    description: string | null;
    inputs: string | null;
    outputs: string | null;
    type: string;
    visualModel: string;
    isControlPoint: boolean;
  }) => void;
}) {
  const resolvedModel = resolveVisualModel(step.visualModel, step.type);
  const [draft, setDraft] = useState({
    number: step.number,
    name: step.name,
    description: step.description ?? '',
    inputs: step.inputs ?? '',
    outputs: step.outputs ?? '',
    type: step.type,
    visualModel: resolvedModel,
    isControlPoint: step.isControlPoint,
  });

  useEffect(() => {
    setDraft({
      number: step.number,
      name: step.name,
      description: step.description ?? '',
      inputs: step.inputs ?? '',
      outputs: step.outputs ?? '',
      type: step.type,
      visualModel: resolveVisualModel(step.visualModel, step.type),
      isControlPoint: step.isControlPoint,
    });
  }, [step.description, step.id, step.inputs, step.isControlPoint, step.name, step.number, step.outputs, step.type, step.visualModel]);

  const changed =
    draft.number !== step.number ||
    draft.name.trim() !== step.name ||
    draft.description.trim() !== (step.description ?? '') ||
    draft.inputs.trim() !== (step.inputs ?? '') ||
    draft.outputs.trim() !== (step.outputs ?? '') ||
    draft.type !== step.type ||
    draft.visualModel !== resolvedModel ||
    draft.isControlPoint !== step.isControlPoint;

  return (
    <aside className="flex h-[70vh] w-full shrink-0 flex-col gap-4 overflow-y-auto border-t bg-white p-4 animate-in slide-in-from-right duration-200 dark:bg-slate-900 md:w-80 md:border-l md:border-t-0">
      <div className="flex items-center justify-between border-b pb-2">
        <div>
          <h3 className="text-sm font-semibold">Editar etapa</h3>
          <p className="text-[11px] text-muted-foreground">As alterações são aplicadas ao salvar.</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Fechar edição">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-[5rem_1fr] gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Ordem</label>
          <input
            type="number"
            min={1}
            className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={draft.number}
            onChange={(event) => setDraft((current) => ({ ...current, number: Math.max(1, Number(event.target.value) || 1) }))}
            disabled={!canManage}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Nome da etapa</label>
          <input
            type="text"
            className="w-full rounded-md border bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            disabled={!canManage}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground">Categoria do processo</label>
        <select
          className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-900"
          value={draft.type}
          onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as IsometricStep['type'] }))}
          disabled={!canManage}
        >
          {STEP_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground">Modelo 3D detalhado</label>
        <select
          className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-900"
          value={draft.visualModel}
          onChange={(event) => setDraft((current) => ({ ...current, visualModel: event.target.value as VisualModelId }))}
          disabled={!canManage}
        >
          {VISUAL_MODEL_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="text-[10px] leading-4 text-muted-foreground">
          {getVisualModelDefinition(draft.visualModel, draft.type).description}
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground">Descrição operacional</label>
        <textarea
          rows={3}
          className="w-full resize-none rounded-md border bg-transparent px-3 py-2 text-xs leading-5 focus:outline-none focus:ring-2 focus:ring-sky-500"
          value={draft.description}
          onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
          disabled={!canManage}
          placeholder="O que acontece nesta etapa, equipamentos e controles envolvidos."
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Entradas</label>
          <textarea
            rows={2}
            className="w-full resize-none rounded-md border bg-transparent px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={draft.inputs}
            onChange={(event) => setDraft((current) => ({ ...current, inputs: event.target.value }))}
            disabled={!canManage}
            placeholder="Matérias-primas, água, embalagem..."
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Saídas</label>
          <textarea
            rows={2}
            className="w-full resize-none rounded-md border bg-transparent px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={draft.outputs}
            onChange={(event) => setDraft((current) => ({ ...current, outputs: event.target.value }))}
            disabled={!canManage}
            placeholder="Produto, subproduto, lote liberado..."
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-center justify-between rounded-lg border bg-slate-50/50 p-3 dark:bg-slate-900/50">
        <span>
          <span className="block text-xs font-semibold">Ponto Crítico de Controle (PCC)</span>
          <span className="block text-[10px] text-muted-foreground">Destaca a etapa e ativa o sinalizador vermelho.</span>
        </span>
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          checked={draft.isControlPoint}
          onChange={(event) => setDraft((current) => ({ ...current, isControlPoint: event.target.checked }))}
          disabled={!canManage}
        />
      </label>

      {canManage && (
        <div className="mt-auto space-y-2 border-t pt-4">
          <Button
            className="w-full"
            size="sm"
            disabled={!changed || !draft.name.trim()}
            onClick={() => onUpdate({
              ...draft,
              name: draft.name.trim(),
              description: draft.description.trim() || null,
              inputs: draft.inputs.trim() || null,
              outputs: draft.outputs.trim() || null,
            })}
          >
            <Save className="mr-2 h-4 w-4" />
            Salvar alterações
          </Button>
          <Button
            variant="ghost"
            className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
            size="sm"
            onClick={() => {
              if (window.confirm(`Tem certeza que deseja excluir a etapa "${step.name}"?`)) onDelete();
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir etapa
          </Button>
        </div>
      )}
    </aside>
  );
}

function CreateStepDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: {
    name: string;
    description?: string;
    type: IsometricStep['type'];
    visualModel: VisualModelId;
    isControlPoint: boolean;
  }) => void;
}) {
  const [draft, setDraft] = useState<{
    name: string;
    description: string;
    type: IsometricStep['type'];
    visualModel: VisualModelId;
    isControlPoint: boolean;
  }>({
    name: '',
    description: '',
    type: 'PROCESSING',
    visualModel: 'PROCESSING_PLANT',
    isControlPoint: false,
  });

  const submit = () => {
    const name = draft.name.trim();
    if (!name) return;
    onCreate({ ...draft, name, description: draft.description.trim() || undefined });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar etapa ao fluxo</DialogTitle>
          <DialogDescription>
            Informe o nome e escolha o modelo que representa esta etapa do processo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nome da etapa</label>
            <input
              autoFocus
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit();
              }}
              placeholder="Ex.: Recebimento da matéria-prima"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Descrição da operação</label>
            <textarea
              rows={2}
              className="w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={draft.description}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              placeholder="Explique resumidamente o que acontece nesta etapa."
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Categoria</label>
              <select
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-900"
                value={draft.type}
                onChange={(event) => {
                  const type = event.target.value as IsometricStep['type'];
                  setDraft((current) => ({
                    ...current,
                    type,
                    visualModel: resolveVisualModel(null, type),
                  }));
                }}
              >
                {STEP_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Modelo 3D</label>
              <select
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-900"
                value={draft.visualModel}
                onChange={(event) => setDraft((current) => ({ ...current, visualModel: event.target.value as VisualModelId }))}
              >
                {VISUAL_MODEL_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-900">
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              {getVisualModelDefinition(draft.visualModel, draft.type).label}
            </div>
            <p className="mt-1 leading-5">{getVisualModelDefinition(draft.visualModel, draft.type).description}</p>
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              checked={draft.isControlPoint}
              onChange={(event) => setDraft((current) => ({ ...current, isControlPoint: event.target.checked }))}
            />
            Esta etapa é um Ponto Crítico de Controle (PCC)
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!draft.name.trim()} onClick={submit}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar etapa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateLibraryDialog({
  existingSteps,
  onClose,
  onApply,
  companyTemplates = [],
  canManage = false,
  onTemplateDelete,
  onTemplateExport,
  onTemplateImport,
}: {
  existingSteps: number;
  onClose: () => void;
  onApply: (steps: FlowTemplateStep[]) => void;
  companyTemplates?: CompanyFlowTemplate[];
  canManage?: boolean;
  onTemplateDelete?: (id: string) => void;
  onTemplateExport?: (template: CompanyFlowTemplate) => void;
  onTemplateImport?: (payload: { name: string; sector?: string | null; summary?: string | null; color?: string | null; steps: FlowTemplateStep[] }) => void;
}) {
  const allTemplates = useMemo<FlowTemplate[]>(() => [...companyTemplates, ...FLOW_TEMPLATES], [companyTemplates]);
  const [selectedId, setSelectedId] = useState(allTemplates[0]?.id ?? '');
  const importInputRef = useRef<HTMLInputElement>(null);
  const selectedTemplate = allTemplates.find((template) => template.id === selectedId) ?? allTemplates[0];
  const selectedCompanyTemplate = companyTemplates.find((template) => template.id === selectedTemplate?.id) ?? null;

  if (!selectedTemplate) return null;

  const applyTemplate = () => {
    onApply(selectedTemplate.steps);
    onClose();
  };

  const handleImportFile = async (file: File | null) => {
    if (!file || !onTemplateImport) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const steps = Array.isArray(payload?.steps) ? payload.steps : [];
      if (!payload?.name || !steps.length) throw new Error('invalid');
      onTemplateImport({
        name: String(payload.name),
        sector: payload.sector ?? null,
        summary: payload.summary ?? null,
        color: payload.color ?? null,
        steps,
      });
    } catch {
      // JSON invalido: o chamador ja exibe toasts das mutations; aqui basta alertar.
      window.alert('Arquivo inválido. Selecione um JSON exportado de um modelo de fluxo.');
    }
  };

  const renderTemplateButton = (template: FlowTemplate) => {
    const selected = template.id === selectedTemplate.id;
    return (
      <button
        key={template.id}
        type="button"
        onClick={() => setSelectedId(template.id)}
        className={`w-full rounded-xl border p-3 text-left transition-all ${
          selected
            ? 'border-sky-500 bg-white shadow-sm ring-2 ring-sky-500/20 dark:bg-slate-900'
            : 'border-transparent hover:border-slate-200 hover:bg-white dark:hover:border-slate-800 dark:hover:bg-slate-900'
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
            style={{ backgroundColor: template.color }}
          >
            <Boxes className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {template.sector}
            </span>
            <span className="mt-0.5 block text-sm font-semibold">{template.name}</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {template.steps.length} etapas
            </span>
          </span>
        </div>
      </button>
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[88vh] max-w-6xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="flex items-center gap-2">
            <Library className="h-5 w-5 text-sky-600" />
            Biblioteca de fluxos industriais
          </DialogTitle>
          <DialogDescription>
            Use um ciclo completo como ponto de partida e adapte nomes, riscos, entradas, saídas e modelos 3D.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 md:grid-cols-[20rem_minmax(0,1fr)]">
          <div className="overflow-y-auto border-r bg-slate-50/70 p-3 dark:bg-slate-950/30">
            {companyTemplates.length > 0 && (
              <>
                <div className="px-1 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Modelos da empresa
                </div>
                <div className="space-y-2">{companyTemplates.map(renderTemplateButton)}</div>
                <div className="px-1 pb-2 pt-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Biblioteca padrão
                </div>
              </>
            )}
            <div className="space-y-2">
              {FLOW_TEMPLATES.map(renderTemplateButton)}
            </div>
            {canManage && onTemplateImport && (
              <div className="mt-3 border-t pt-3">
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(event) => {
                    void handleImportFile(event.target.files?.[0] ?? null);
                    event.target.value = '';
                  }}
                />
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => importInputRef.current?.click()}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Importar modelo (JSON)
                </Button>
              </div>
            )}
          </div>

          <div className="min-h-0 overflow-y-auto p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Badge variant="outline" style={{ borderColor: selectedTemplate.color, color: selectedTemplate.color }}>
                  {selectedTemplate.sector}
                </Badge>
                <h3 className="mt-2 text-xl font-semibold">{selectedTemplate.name}</h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {selectedTemplate.summary}
                </p>
                {selectedCompanyTemplate && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {onTemplateExport && (
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onTemplateExport(selectedCompanyTemplate)}>
                        Exportar JSON
                      </Button>
                    )}
                    {canManage && onTemplateDelete && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs text-red-600 hover:text-red-700"
                        onClick={() => {
                          if (window.confirm(`Excluir o modelo "${selectedCompanyTemplate.name}"?`)) {
                            onTemplateDelete(selectedCompanyTemplate.persistedId);
                            setSelectedId(FLOW_TEMPLATES[0]?.id ?? '');
                          }
                        }}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Excluir modelo
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="rounded-lg border bg-slate-50 px-3 py-2 text-right dark:bg-slate-900">
                <div className="text-lg font-bold">{selectedTemplate.steps.length}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">etapas detalhadas</div>
              </div>
            </div>

            <div className="mt-5 rounded-xl border bg-slate-50/60 p-3 dark:bg-slate-950/30">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Sequência do processo
              </div>
              <div className="grid gap-2 lg:grid-cols-2">
                {selectedTemplate.steps.map((step, index) => {
                  const model = getVisualModelDefinition(step.visualModel, step.type);
                  return (
                    <div key={`${selectedTemplate.id}-${index}`} className="flex items-center gap-2 rounded-lg border bg-background p-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white dark:bg-slate-100 dark:text-slate-900">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold">{step.name}</span>
                        <span className="block truncate text-[10px] text-muted-foreground">{model.label}</span>
                      </span>
                      {step.isControlPoint && (
                        <Badge className="h-5 bg-red-500 px-1.5 text-[9px] hover:bg-red-500">PCC</Badge>
                      )}
                      {index < selectedTemplate.steps.length - 1 && (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {existingSteps > 0 && (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                Este processo já possui {existingSteps} etapa{existingSteps === 1 ? '' : 's'}. O modelo será adicionado ao final,
                preservando o conteúdo atual.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="border-t bg-slate-50/70 px-6 py-4 dark:bg-slate-950/30">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button className="bg-sky-600 hover:bg-sky-700" onClick={applyTemplate}>
            <Library className="mr-2 h-4 w-4" />
            Adicionar {selectedTemplate.steps.length} etapas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------------
// 4. Componente Principal do Editor Canvas
// ----------------------------------------------------------------------

export function IsometricFlow({
  steps,
  canManage,
  onStepMove,
  onStepsArrange,
  onStepCreate,
  onTemplateApply,
  onStepDelete,
  onStepUpdate,
  companyTemplates,
  onTemplateSave,
  onTemplateDelete,
  onTemplateExport,
  onTemplateImport,
}: IsometricFlowProps) {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [creatingStep, setCreatingStep] = useState(false);
  const [templateLibraryOpen, setTemplateLibraryOpen] = useState(false);
  const cameraRef = useRef<FlowCameraHandle>(null);
  const sortedSteps = useMemo(
    () => [...(steps ?? [])].sort((a, b) => (a?.number ?? 0) - (b?.number ?? 0)),
    [steps],
  );
  const positionedSteps = useMemo(() => positionSteps(sortedSteps), [sortedSteps]);
  const cameraPositions = useMemo(
    () => positionedSteps.map((step) => ({
      x: step.positionX / API_POSITION_SCALE,
      z: step.positionY / API_POSITION_SCALE,
    })),
    [positionedSteps],
  );
  const fitKey = positionedSteps.map((step) => step.id).join('|');
  const selectedStep = steps.find((step) => step.id === selectedStepId) ?? null;
  const controlPointCount = positionedSteps.filter((step) => step.isControlPoint).length;
  const activeModels = useMemo(() => {
    const definitions = new Map<VisualModelId, ReturnType<typeof getVisualModelDefinition>>();
    positionedSteps.forEach((step) => {
      const definition = getVisualModelDefinition(step.visualModel, step.type);
      definitions.set(definition.id, definition);
    });
    return [...definitions.values()];
  }, [positionedSteps]);

  useEffect(() => {
    if (selectedStepId && !selectedStep) setSelectedStepId(null);
  }, [selectedStep, selectedStepId]);

  const handleArrange = () => {
    const layout = createAutomaticLayout(sortedSteps);
    onStepsArrange(layout.map((step) => ({
      id: step.id,
      positionX: step.positionX,
      positionY: step.positionY,
    })));
  };

  return (
    <Card className="overflow-hidden border-2">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 px-4 py-3 dark:bg-slate-900/20">
        <div className="flex items-center gap-2">
          <Badge className="bg-sky-500 hover:bg-sky-600">3D Isométrico</Badge>
          <div>
            <p className="text-xs text-muted-foreground">
              {canManage
                ? 'Arraste uma etapa para reposicionar · clique para editar.'
                : 'Inspecione a cadeia tridimensional do processo.'}
            </p>
            <p className="hidden text-[10px] text-muted-foreground/80 lg:block">
              Arraste o fundo para mover · use a roda do mouse para zoom · botão direito para girar.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 px-2.5 text-xs"
                onClick={() => setTemplateLibraryOpen(true)}
                title="Adicionar um ciclo industrial completo"
              >
                <Library className="h-3.5 w-3.5 text-sky-600" />
                Biblioteca de fluxos
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 px-2.5 text-xs"
                onClick={handleArrange}
                disabled={positionedSteps.length === 0}
                title="Distribuir as etapas automaticamente"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Organizar
              </Button>
              {onTemplateSave && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 px-2.5 text-xs"
                  disabled={positionedSteps.length === 0}
                  title="Salvar este fluxo como modelo reutilizável da empresa"
                  onClick={() => {
                    const name = window.prompt('Nome do modelo de fluxo');
                    if (name?.trim()) onTemplateSave({ name: name.trim() });
                  }}
                >
                  <Save className="h-3.5 w-3.5 text-emerald-600" />
                  Salvar como modelo
                </Button>
              )}
              <Button
                size="sm"
                className="h-8 gap-1 bg-emerald-600 px-2.5 text-xs font-medium text-white shadow-sm transition-all hover:bg-emerald-700"
                onClick={() => setCreatingStep(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar etapa
              </Button>
            </>
          )}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => cameraRef.current?.zoomIn()} title="Aumentar zoom" aria-label="Aumentar zoom">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => cameraRef.current?.zoomOut()} title="Diminuir zoom" aria-label="Diminuir zoom">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => cameraRef.current?.fit()} title="Enquadrar todo o fluxo" aria-label="Enquadrar todo o fluxo">
              <Focus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <CardContent className="relative flex flex-col overflow-hidden p-0 md:flex-row">
        <div
          className="relative h-[70vh] min-h-[32rem] min-w-0 flex-1 bg-[#edf4f7] dark:bg-slate-950/30"
          onContextMenu={(event) => event.preventDefault()}
        >
          <Canvas
            shadows
            dpr={[1, 1.5]}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
            onPointerMissed={() => setSelectedStepId(null)}
          >
            <color attach="background" args={['#edf4f7']} />
            <fog attach="fog" args={['#edf4f7', 25, 60]} />

            {/* Câmera Isométrica Ortográfica */}
            <OrthographicCamera
              makeDefault
              position={[16, 16, 16]}
              zoom={DEFAULT_ZOOM}
              near={0.1}
              far={1000}
            />

            {/* Iluminação industrial equilibrada para destacar volume e materiais. */}
            <hemisphereLight args={['#ffffff', '#b6c4cf', 1.1]} />
            <ambientLight intensity={0.55} />
            
            {/* Iluminação Direcional (Sol) com Sombras */}
            <directionalLight 
              position={[10, 20, 10]} 
              intensity={1.45}
              castShadow 
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
              shadow-bias={-0.0004}
            />

            {/* Iluminação de preenchimento suave */}
            <directionalLight position={[-10, 7, -10]} intensity={0.35} />

            {/* Grid Helper Isométrico no Chão */}
            <gridHelper args={[34, 34, '#91a7b8', '#cedbe4']} position={[0, 0.002, 0]} />

            {/* Piso real: mantém escala espacial e recebe as sombras dos equipamentos. */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]} receiveShadow>
              <planeGeometry args={[80, 80]} />
              <meshStandardMaterial color="#edf4f7" roughness={0.96} />
            </mesh>

            {/* Conexões (Setas de Fluxo) */}
            {positionedSteps.map((step, idx) => {
              if (idx === positionedSteps.length - 1) return null;
              const nextStep = positionedSteps[idx + 1];
              return (
                <StepConnection 
                  key={`conn-${step.id}-${nextStep.id}`}
                  fromStep={step}
                  toStep={nextStep}
                />
              );
            })}

            {/* Blocos das Etapas */}
            {positionedSteps.map((step) => (
              <StepBlock
                key={step.id}
                step={step}
                canManage={canManage}
                selected={selectedStepId === step.id}
                onClick={() => setSelectedStepId(step.id)}
                onMove={onStepMove}
              />
            ))}

            {/* Controles de Câmera */}
            <FlowCameraControls
              ref={cameraRef}
              positions={cameraPositions}
              fitKey={fitKey}
            />
          </Canvas>
          {positionedSteps.length > 0 && (
            <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap gap-2">
              <Badge variant="secondary" className="border bg-white/90 shadow-sm backdrop-blur dark:bg-slate-900/90">
                {positionedSteps.length} etapa{positionedSteps.length === 1 ? '' : 's'}
              </Badge>
              {controlPointCount > 0 && (
                <Badge className="border border-red-200 bg-red-50 text-red-700 shadow-sm hover:bg-red-50">
                  {controlPointCount} PCC
                </Badge>
              )}
            </div>
          )}
          {positionedSteps.length === 0 && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
              <div className="max-w-sm rounded-xl border bg-white/95 p-6 text-center shadow-lg backdrop-blur dark:bg-slate-900/95">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-sky-50 text-sky-600 dark:bg-sky-950/50">
                  <Plus className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold">Este processo ainda não possui etapas</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Adicione a primeira etapa para iniciar o mapeamento do fluxo.
                </p>
                {canManage && (
                  <div className="pointer-events-auto mt-4 flex flex-wrap justify-center gap-2">
                    <Button size="sm" onClick={() => setTemplateLibraryOpen(true)}>
                      <Library className="mr-2 h-4 w-4" />
                      Usar fluxo completo
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCreatingStep(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Criar etapa
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Painel Lateral de Controle (Inspector) */}
        {selectedStep && (
          <StepInspector
            step={selectedStep}
            canManage={canManage}
            onClose={() => setSelectedStepId(null)}
            onDelete={() => {
              onStepDelete(selectedStep.id);
              setSelectedStepId(null);
            }}
            onUpdate={(data) => onStepUpdate(selectedStep.id, data)}
          />
        )}
      </CardContent>

      {/* Rodapé informativo derivado dos modelos realmente usados no processo. */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t bg-slate-50/50 px-4 py-2.5 text-xs text-muted-foreground dark:bg-slate-900/10">
        {activeModels.slice(0, 10).map((model) => (
          <div key={model.id} className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded border" style={{ backgroundColor: model.color }} />
            <span>{model.label}</span>
          </div>
        ))}
        {activeModels.length > 10 && (
          <span className="font-medium text-slate-500">+{activeModels.length - 10} modelos</span>
        )}
        <div className="flex items-center gap-1.5">
          <div className="h-3.5 w-3.5 animate-pulse rounded-full bg-red-500" />
          <span className="font-semibold text-red-600">Ponto Crítico de Controle (PCC)</span>
        </div>
      </div>
      {creatingStep && (
        <CreateStepDialog
          onClose={() => setCreatingStep(false)}
          onCreate={onStepCreate}
        />
      )}
      {templateLibraryOpen && (
        <TemplateLibraryDialog
          existingSteps={positionedSteps.length}
          onClose={() => setTemplateLibraryOpen(false)}
          onApply={onTemplateApply}
          companyTemplates={companyTemplates}
          canManage={canManage}
          onTemplateDelete={onTemplateDelete}
          onTemplateExport={onTemplateExport}
          onTemplateImport={onTemplateImport}
        />
      )}
    </Card>
  );
}
