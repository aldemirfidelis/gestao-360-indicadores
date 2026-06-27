'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrthographicCamera, OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

// Tipagem das etapas para o fluxo 3D
export interface IsometricStep {
  id: string;
  number: number;
  name: string;
  type: 'RECEIVING' | 'STORAGE' | 'PROCESSING' | 'PACKAGING' | 'TRANSPORT' | 'DISTRIBUTION' | 'OTHER';
  positionX: number | null;
  positionY: number | null;
  isControlPoint: boolean;
}

interface IsometricFlowProps {
  steps: IsometricStep[];
  canManage: boolean;
  onStepClick: (step: IsometricStep) => void;
  onStepMove: (id: string, x: number, y: number) => void;
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
  onClick: () => void;
  onMove: (id: string, x: number, z: number) => void;
}

function StepBlock({ step, canManage, onClick, onMove }: StepBlockProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const dragOffset = useRef(new THREE.Vector3());

  // Coordenadas 3D iniciais: convertemos positionX/positionY salvos na escala React Flow
  const initialX = step.positionX !== null ? step.positionX / 100 : 0;
  const initialZ = step.positionY !== null ? step.positionY / 100 : 0;

  useEffect(() => {
    if (groupRef.current && !dragging) {
      groupRef.current.position.set(initialX, 0, initialZ);
    }
  }, [initialX, initialZ, dragging]);

  // Escolhe o modelo correspondente
  const renderModel = () => {
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

  // Lógica do Drag-and-Drop 3D com Raycasting no plano XZ (y=0)
  const handlePointerDown = (e: THREE.Event & PointerEvent) => {
    if (!canManage) return;
    e.stopPropagation();
    
    // Captura o foco do mouse
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);

    const intersection = new THREE.Vector3();
    // Interseção do raio da câmera com o plano Y = 0
    e.ray.intersectPlane(planeRef.current, intersection);

    if (groupRef.current) {
      dragOffset.current.copy(groupRef.current.position).sub(intersection);
    }
  };

  const handlePointerMove = (e: THREE.Event & PointerEvent) => {
    if (!dragging || !groupRef.current) return;
    e.stopPropagation();

    const intersection = new THREE.Vector3();
    e.ray.intersectPlane(planeRef.current, intersection);

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

  const handlePointerUp = (e: THREE.Event & PointerEvent) => {
    if (!dragging) return;
    e.stopPropagation();
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    setDragging(false);

    if (groupRef.current) {
      const finalX = Math.round(groupRef.current.position.x * 100);
      const finalZ = Math.round(groupRef.current.position.z * 100);
      // Salva de volta nas coordenadas da API
      if (finalX !== step.positionX || finalZ !== step.positionY) {
        onMove(step.id, finalX, finalZ);
      }
    }
  };

  return (
    <group 
      ref={groupRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
    >
      {/* Modelo Visual */}
      {renderModel()}

      {/* Farol PCC */}
      <PCCBeacon active={step.isControlPoint} />

      {/* Placa com nome flutuante */}
      <Html position={[0, 1.4, 0]} center distanceFactor={7}>
        <div 
          onClick={(e) => {
            e.stopPropagation();
            if (!dragging) onClick();
          }}
          className={`flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-2.5 py-0.5 shadow-md transition-all ${
            step.isControlPoint 
              ? 'border-red-400 bg-red-50 text-red-700 hover:bg-red-100' 
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          } ${hovered || dragging ? 'scale-105 ring-2 ring-sky-500' : ''}`}
        >
          <span className="text-[10px] font-bold opacity-60">#{step.number}</span>
          <span className="max-w-[8rem] truncate text-[11px] font-semibold">{step.name}</span>
        </div>
      </Html>

      {/* Caixa invisível maior para facilitar click e drag */}
      <mesh position={[0, 0.4, 0]} visible={false}>
        <boxGeometry args={[1.8, 1.0, 1.8]} />
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
  const fromX = fromStep.positionX !== null ? fromStep.positionX / 100 : 0;
  const fromZ = fromStep.positionY !== null ? fromStep.positionY / 100 : 0;
  const toX = toStep.positionX !== null ? toStep.positionX / 100 : 0;
  const toZ = toStep.positionY !== null ? toStep.positionY / 100 : 0;

  const start = new THREE.Vector3(fromX, 0.1, fromZ);
  const end = new THREE.Vector3(toX, 0.1, toZ);
  
  const distance = start.distanceTo(end);
  if (distance < 0.6) return null; // Muito perto, não desenha

  const direction = new THREE.Vector3().subVectors(end, start).normalize();
  const alignAxis = new THREE.Vector3(0, 1, 0);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(alignAxis, direction);
  const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

  return (
    <group>
      {/* Cano do Fluxo */}
      <mesh position={midPoint} quaternion={quaternion}>
        <cylinderGeometry args={[0.04, 0.04, distance - 0.4, 6]} />
        <meshStandardMaterial 
          color="#0284c7" 
          emissive="#0284c7" 
          emissiveIntensity={0.2}
          roughness={0.2} 
        />
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

// ----------------------------------------------------------------------
// 4. Componente Principal do Editor Canvas
// ----------------------------------------------------------------------

export function IsometricFlow({ steps, canManage, onStepClick, onStepMove }: IsometricFlowProps) {
  const [zoom, setZoom] = useState(42);
  const orbitRef = useRef<any>(null);

  // Ordena as etapas por número
  const sortedSteps = [...steps].sort((a, b) => a.number - b.number);

  // Distribuição inicial sequencial caso as coordenadas sejam nulas
  const positionedSteps = sortedSteps.map((step, idx) => {
    if (step.positionX === null || step.positionY === null) {
      // Auto distribuição em linha no plano
      return {
        ...step,
        positionX: step.positionX ?? (idx - (sortedSteps.length - 1) / 2) * 250,
        positionY: step.positionY ?? 0,
      };
    }
    return step;
  });

  const handleResetCamera = () => {
    if (orbitRef.current) {
      orbitRef.current.reset();
    }
  };

  return (
    <Card className="overflow-hidden border-2">
      <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3 dark:bg-slate-900/20">
        <div className="flex items-center gap-2">
          <Badge className="bg-sky-500 hover:bg-sky-600">3D Isométrico</Badge>
          <span className="text-xs text-muted-foreground">
            {canManage 
              ? 'Arraste os modelos para reposicionar no grid · Clique na placa com o nome da etapa para editá-la.' 
              : 'Clique nas etapas para inspecionar perigos.'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(80, z + 5))} title="Aumentar Zoom">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(15, z - 5))} title="Diminuir Zoom">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleResetCamera} title="Resetar Câmera">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <CardContent className="relative p-0">
        <div className="h-[70vh] bg-slate-100 dark:bg-slate-950/30">
          <Canvas shadows dpr={[1, 2]}>
            {/* Câmera Isométrica Ortográfica */}
            <OrthographicCamera 
              makeDefault 
              position={[15, 15, 15]} 
              zoom={zoom} 
              near={0.1} 
              far={1000} 
            />

            {/* Iluminação Ambiente Suave */}
            <ambientLight intensity={0.95} />
            
            {/* Iluminação Direcional (Sol) com Sombras */}
            <directionalLight 
              position={[10, 20, 10]} 
              intensity={1.2} 
              castShadow 
              shadow-mapSize-width={1024} 
              shadow-mapSize-height={1024} 
            />

            {/* Iluminação de preenchimento suave */}
            <directionalLight position={[-10, 5, -10]} intensity={0.4} />

            {/* Grid Helper Isométrico no Chão */}
            <gridHelper args={[32, 32, '#94a3b8', '#cbd5e1']} position={[0, -0.01, 0]} />

            {/* Plano de sombra invisível */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
              <planeGeometry args={[100, 100]} />
              <shadowMaterial opacity={0.2} />
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
                onClick={() => onStepClick(step)}
                onMove={onStepMove}
              />
            ))}

            {/* Controles de Câmera */}
            <OrbitControls 
              ref={orbitRef}
              enableRotate={true}
              enableZoom={false} // Zoom controlado manualmente para manter a escala ortográfica
              enableDamping={true}
              dampingFactor={0.05}
              maxPolarAngle={Math.PI / 2.1} // Evita ir abaixo do chão
              minPolarAngle={Math.PI / 6}
            />
          </Canvas>
        </div>

        {/* Rodapé informativo */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t bg-slate-50/50 px-4 py-2.5 text-xs text-muted-foreground dark:bg-slate-900/10">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded border bg-[#64748b]" />
            <span>Recepção</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded border bg-[#94a3b8]" />
            <span>Armazenamento (Silo)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded border bg-[#e2e8f0]" />
            <span>Processamento</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded border bg-[#0d9488]" />
            <span>Embalagem</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded border bg-[#2563eb]" />
            <span>Transporte</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded border bg-[#f8fafc]" />
            <span>Distribuição (Loja)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3.5 w-3.5 animate-pulse rounded-full bg-red-500" />
            <span className="font-semibold text-red-600">Ponto Crítico de Controle (PCC)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
