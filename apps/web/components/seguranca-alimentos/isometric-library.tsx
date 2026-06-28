'use client';

import React from 'react';

export type StepCategory =
  | 'RECEIVING'
  | 'STORAGE'
  | 'PROCESSING'
  | 'PACKAGING'
  | 'TRANSPORT'
  | 'DISTRIBUTION'
  | 'OTHER';

export type VisualModelId =
  | 'FARM_FIELD'
  | 'GREENHOUSE'
  | 'HARVESTER'
  | 'RECEIVING_DOCK'
  | 'WEIGHBRIDGE'
  | 'QUALITY_LAB'
  | 'WASHING_LINE'
  | 'GRAIN_CLEANER'
  | 'SILO_COMPLEX'
  | 'COLD_STORAGE'
  | 'WAREHOUSE'
  | 'MILLING'
  | 'PROCESSING_PLANT'
  | 'MIXING_TANK'
  | 'PASTEURIZER'
  | 'COOKING_KETTLE'
  | 'COOLING_TUNNEL'
  | 'FERMENTATION_TANKS'
  | 'FILLING_LINE'
  | 'PACKAGING_LINE'
  | 'TEXTILE_SPINNING'
  | 'TEXTILE_WEAVING'
  | 'TEXTILE_DYEING'
  | 'TEXTILE_CUT_SEW'
  | 'TRUCK'
  | 'FORKLIFT'
  | 'DISTRIBUTION_CENTER'
  | 'RETAIL_STORE'
  | 'WATER_TREATMENT'
  | 'WASTE_TREATMENT';

export interface VisualModelDefinition {
  id: VisualModelId;
  label: string;
  group: string;
  category: StepCategory;
  description: string;
  color: string;
}

export const VISUAL_MODEL_DEFINITIONS: VisualModelDefinition[] = [
  { id: 'FARM_FIELD', label: 'Lavoura irrigada', group: 'Produção primária', category: 'OTHER', description: 'Talhões, cultivo, irrigação e trator.', color: '#65a30d' },
  { id: 'GREENHOUSE', label: 'Estufa agrícola', group: 'Produção primária', category: 'OTHER', description: 'Cultivo protegido com linhas de plantio.', color: '#22c55e' },
  { id: 'HARVESTER', label: 'Colheita mecanizada', group: 'Produção primária', category: 'TRANSPORT', description: 'Colheitadeira com plataforma frontal.', color: '#eab308' },
  { id: 'RECEIVING_DOCK', label: 'Doca de recebimento', group: 'Recepção e controle', category: 'RECEIVING', description: 'Doca, rampa, pallets e matéria-prima.', color: '#64748b' },
  { id: 'WEIGHBRIDGE', label: 'Balança rodoviária', group: 'Recepção e controle', category: 'RECEIVING', description: 'Plataforma, guarita e cancela.', color: '#475569' },
  { id: 'QUALITY_LAB', label: 'Laboratório de qualidade', group: 'Recepção e controle', category: 'OTHER', description: 'Bancada, microscópio e amostras.', color: '#8b5cf6' },
  { id: 'WASHING_LINE', label: 'Lavagem e seleção', group: 'Preparação', category: 'PROCESSING', description: 'Tanque, esteira e aspersores.', color: '#0ea5e9' },
  { id: 'GRAIN_CLEANER', label: 'Pré-limpeza de grãos', group: 'Preparação', category: 'PROCESSING', description: 'Moega, peneira e dutos de aspiração.', color: '#a16207' },
  { id: 'SILO_COMPLEX', label: 'Complexo de silos', group: 'Armazenamento', category: 'STORAGE', description: 'Silos metálicos, elevador e passarela.', color: '#94a3b8' },
  { id: 'COLD_STORAGE', label: 'Câmara fria', group: 'Armazenamento', category: 'STORAGE', description: 'Câmara isolada e condensadores.', color: '#38bdf8' },
  { id: 'WAREHOUSE', label: 'Armazém com racks', group: 'Armazenamento', category: 'STORAGE', description: 'Porta-paletes, estoque e doca.', color: '#f59e0b' },
  { id: 'MILLING', label: 'Moagem industrial', group: 'Processamento', category: 'PROCESSING', description: 'Moinho, rolos, moega e ensaque.', color: '#d97706' },
  { id: 'PROCESSING_PLANT', label: 'Planta industrial', group: 'Processamento', category: 'PROCESSING', description: 'Galpão detalhado, utilidades e chaminé.', color: '#ef4444' },
  { id: 'MIXING_TANK', label: 'Mistura e formulação', group: 'Processamento', category: 'PROCESSING', description: 'Tanque inox, agitador e tubulações.', color: '#64748b' },
  { id: 'PASTEURIZER', label: 'Pasteurização', group: 'Processamento', category: 'PROCESSING', description: 'Tanques, trocador de calor e painel.', color: '#f97316' },
  { id: 'COOKING_KETTLE', label: 'Cocção industrial', group: 'Processamento', category: 'PROCESSING', description: 'Tacho encamisado, vapor e controle.', color: '#dc2626' },
  { id: 'COOLING_TUNNEL', label: 'Túnel de resfriamento', group: 'Processamento', category: 'PROCESSING', description: 'Túnel, esteira e ventiladores.', color: '#06b6d4' },
  { id: 'FERMENTATION_TANKS', label: 'Fermentação', group: 'Processamento', category: 'PROCESSING', description: 'Fermentadores, válvulas e passarela.', color: '#7c3aed' },
  { id: 'FILLING_LINE', label: 'Linha de envase', group: 'Embalagem', category: 'PACKAGING', description: 'Reservatório, bicos e frascos.', color: '#0891b2' },
  { id: 'PACKAGING_LINE', label: 'Embalagem e paletização', group: 'Embalagem', category: 'PACKAGING', description: 'Seladora, caixas e pallet final.', color: '#0d9488' },
  { id: 'TEXTILE_SPINNING', label: 'Fiação', group: 'Indústria têxtil', category: 'PROCESSING', description: 'Cones, fusos e rolos de fio.', color: '#a855f7' },
  { id: 'TEXTILE_WEAVING', label: 'Tecelagem', group: 'Indústria têxtil', category: 'PROCESSING', description: 'Tear com urdume e tecido.', color: '#6366f1' },
  { id: 'TEXTILE_DYEING', label: 'Tingimento e lavagem', group: 'Indústria têxtil', category: 'PROCESSING', description: 'Barcas, banho colorido e exaustão.', color: '#ec4899' },
  { id: 'TEXTILE_CUT_SEW', label: 'Corte e costura', group: 'Indústria têxtil', category: 'PROCESSING', description: 'Mesa de corte, rolos e máquinas.', color: '#14b8a6' },
  { id: 'TRUCK', label: 'Caminhão de transporte', group: 'Logística', category: 'TRANSPORT', description: 'Cavalo, baú e seis rodas.', color: '#2563eb' },
  { id: 'FORKLIFT', label: 'Empilhadeira', group: 'Logística', category: 'TRANSPORT', description: 'Empilhadeira, garfos e pallet.', color: '#eab308' },
  { id: 'DISTRIBUTION_CENTER', label: 'Centro de distribuição', group: 'Logística', category: 'DISTRIBUTION', description: 'Armazém, docas e carga expedida.', color: '#0f766e' },
  { id: 'RETAIL_STORE', label: 'Varejo / ponto de venda', group: 'Logística', category: 'DISTRIBUTION', description: 'Loja, gôndolas e fachada.', color: '#ea580c' },
  { id: 'WATER_TREATMENT', label: 'Tratamento de água', group: 'Utilidades', category: 'OTHER', description: 'Filtros, reservatório e bombas.', color: '#0284c7' },
  { id: 'WASTE_TREATMENT', label: 'Tratamento de efluentes', group: 'Utilidades', category: 'OTHER', description: 'Decantador, aeração e tubulações.', color: '#16a34a' },
];

const DEFINITION_BY_ID = new Map(VISUAL_MODEL_DEFINITIONS.map((item) => [item.id, item]));

const DEFAULT_MODEL_BY_CATEGORY: Record<StepCategory, VisualModelId> = {
  RECEIVING: 'RECEIVING_DOCK',
  STORAGE: 'SILO_COMPLEX',
  PROCESSING: 'PROCESSING_PLANT',
  PACKAGING: 'PACKAGING_LINE',
  TRANSPORT: 'TRUCK',
  DISTRIBUTION: 'RETAIL_STORE',
  OTHER: 'QUALITY_LAB',
};

export function resolveVisualModel(model: string | null | undefined, category: StepCategory): VisualModelId {
  return DEFINITION_BY_ID.has(model as VisualModelId)
    ? model as VisualModelId
    : DEFAULT_MODEL_BY_CATEGORY[category];
}

export function getVisualModelDefinition(model: string | null | undefined, category: StepCategory) {
  return DEFINITION_BY_ID.get(resolveVisualModel(model, category))!;
}

type Vec3 = [number, number, number];

function BoxPart({
  position,
  size,
  color,
  rotation,
  metalness = 0.05,
  roughness = 0.65,
  opacity = 1,
}: {
  position: Vec3;
  size: Vec3;
  color: string;
  rotation?: Vec3;
  metalness?: number;
  roughness?: number;
  opacity?: number;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        metalness={metalness}
        roughness={roughness}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}

function CylinderPart({
  position,
  radius = 0.2,
  height = 0.5,
  color,
  rotation,
  segments = 16,
  metalness = 0.15,
  roughness = 0.5,
}: {
  position: Vec3;
  radius?: number;
  height?: number;
  color: string;
  rotation?: Vec3;
  segments?: number;
  metalness?: number;
  roughness?: number;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <cylinderGeometry args={[radius, radius, height, segments]} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
    </mesh>
  );
}

function ConePart({
  position,
  radius,
  height,
  color,
  rotation,
}: {
  position: Vec3;
  radius: number;
  height: number;
  color: string;
  rotation?: Vec3;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <coneGeometry args={[radius, height, 16]} />
      <meshStandardMaterial color={color} metalness={0.1} roughness={0.55} />
    </mesh>
  );
}

function SpherePart({ position, radius, color }: { position: Vec3; radius: number; color: string }) {
  return (
    <mesh position={position} castShadow>
      <sphereGeometry args={[radius, 12, 8]} />
      <meshStandardMaterial color={color} roughness={0.65} />
    </mesh>
  );
}

function Wheel({ position, radius = 0.16 }: { position: Vec3; radius?: number }) {
  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[radius, radius, 0.13, 12]} />
      <meshStandardMaterial color="#172033" roughness={0.85} />
    </mesh>
  );
}

function Crop({ x, z, color = '#65a30d' }: { x: number; z: number; color?: string }) {
  return (
    <group position={[x, 0, z]}>
      <CylinderPart position={[0, 0.2, 0]} radius={0.018} height={0.38} color="#4d7c0f" />
      <ConePart position={[-0.06, 0.28, 0]} radius={0.08} height={0.18} color={color} rotation={[0, 0, -0.8]} />
      <ConePart position={[0.06, 0.34, 0]} radius={0.08} height={0.18} color={color} rotation={[0, 0, 0.8]} />
    </group>
  );
}

function AgricultureModel({ kind }: { kind: 'field' | 'greenhouse' | 'harvester' }) {
  if (kind === 'harvester') {
    return (
      <group>
        <BoxPart position={[0, 0.25, 0]} size={[1.25, 0.3, 0.72]} color="#eab308" />
        <BoxPart position={[0.15, 0.62, 0]} size={[0.55, 0.52, 0.62]} color="#facc15" />
        <BoxPart position={[0.18, 0.7, 0.32]} size={[0.4, 0.25, 0.04]} color="#7dd3fc" metalness={0.25} roughness={0.15} />
        <BoxPart position={[-0.4, 0.57, 0]} size={[0.45, 0.45, 0.65]} color="#ca8a04" />
        <Wheel position={[-0.4, 0.08, -0.35]} radius={0.24} />
        <Wheel position={[-0.4, 0.08, 0.35]} radius={0.24} />
        <Wheel position={[0.42, 0.1, -0.34]} radius={0.18} />
        <Wheel position={[0.42, 0.1, 0.34]} radius={0.18} />
        <BoxPart position={[0.78, 0.12, 0]} size={[0.15, 0.12, 1.25]} color="#334155" />
        {[-0.48, -0.24, 0, 0.24, 0.48].map((z) => (
          <BoxPart key={z} position={[0.93, 0.09, z]} size={[0.45, 0.05, 0.035]} color="#1f2937" rotation={[0, 0, -0.12]} />
        ))}
        <CylinderPart position={[-0.32, 0.95, 0]} radius={0.06} height={0.55} color="#475569" rotation={[0, 0, Math.PI / 2]} />
      </group>
    );
  }

  if (kind === 'greenhouse') {
    return (
      <group>
        <BoxPart position={[0, 0.04, 0]} size={[1.9, 0.08, 1.55]} color="#4d7c0f" />
        <BoxPart position={[0, 0.62, 0]} size={[1.8, 1.12, 1.45]} color="#dff7ed" opacity={0.3} roughness={0.1} />
        {[-0.86, 0, 0.86].map((x) => (
          <group key={x}>
            <BoxPart position={[x, 0.62, -0.7]} size={[0.035, 1.15, 0.035]} color="#64748b" metalness={0.7} />
            <BoxPart position={[x, 0.62, 0.7]} size={[0.035, 1.15, 0.035]} color="#64748b" metalness={0.7} />
          </group>
        ))}
        {[-0.42, 0, 0.42].map((z) => (
          <group key={z}>
            {[-0.55, -0.25, 0.05, 0.35, 0.65].map((x) => <Crop key={x} x={x} z={z} color="#16a34a" />)}
          </group>
        ))}
        <BoxPart position={[0.9, 0.38, 0]} size={[0.04, 0.76, 0.5]} color="#0f766e" />
      </group>
    );
  }

  return (
    <group>
      <BoxPart position={[0, 0.025, 0]} size={[2.05, 0.05, 1.75]} color="#8b5a2b" roughness={1} />
      {[-0.65, -0.35, -0.05, 0.25, 0.55].map((z) => (
        <group key={z}>
          <BoxPart position={[-0.12, 0.055, z]} size={[1.55, 0.035, 0.13]} color="#4d7c0f" roughness={1} />
          {[-0.75, -0.45, -0.15, 0.15, 0.45].map((x) => <Crop key={x} x={x} z={z} />)}
        </group>
      ))}
      <BoxPart position={[0.75, 0.23, -0.5]} size={[0.42, 0.28, 0.32]} color="#16a34a" />
      <Wheel position={[0.62, 0.09, -0.68]} radius={0.13} />
      <Wheel position={[0.88, 0.09, -0.68]} radius={0.13} />
      <CylinderPart position={[0.8, 0.72, 0.25]} radius={0.035} height={1.25} color="#94a3b8" />
      <BoxPart position={[0.35, 1.1, 0.25]} size={[0.9, 0.025, 0.025]} color="#94a3b8" rotation={[0, 0, -0.15]} />
      <CylinderPart position={[-0.1, 0.98, 0.25]} radius={0.025} height={0.65} color="#38bdf8" rotation={[0, 0, Math.PI / 2]} />
    </group>
  );
}

function ReceivingControlModel({ kind }: { kind: 'dock' | 'scale' | 'lab' }) {
  if (kind === 'scale') {
    return (
      <group>
        <BoxPart position={[-0.15, 0.06, 0]} size={[1.65, 0.12, 0.72]} color="#64748b" metalness={0.55} />
        {[-0.26, 0, 0.26].map((z) => <BoxPart key={z} position={[-0.15, 0.13, z]} size={[1.5, 0.015, 0.025]} color="#cbd5e1" />)}
        <BoxPart position={[0.72, 0.35, -0.42]} size={[0.55, 0.65, 0.52]} color="#f8fafc" />
        <BoxPart position={[0.72, 0.48, -0.15]} size={[0.32, 0.25, 0.03]} color="#7dd3fc" opacity={0.75} />
        <CylinderPart position={[0.42, 0.55, 0.5]} radius={0.035} height={0.95} color="#334155" />
        <BoxPart position={[-0.05, 0.92, 0.5]} size={[0.95, 0.06, 0.06]} color="#ef4444" rotation={[0, 0, 0.08]} />
      </group>
    );
  }

  if (kind === 'lab') {
    return (
      <group>
        <BoxPart position={[0, 0.04, 0]} size={[1.85, 0.08, 1.5]} color="#e2e8f0" />
        <BoxPart position={[-0.15, 0.36, 0]} size={[1.5, 0.16, 0.62]} color="#f8fafc" />
        <BoxPart position={[-0.15, 0.48, 0]} size={[1.45, 0.08, 0.58]} color="#cbd5e1" metalness={0.45} />
        <CylinderPart position={[-0.45, 0.7, 0]} radius={0.06} height={0.42} color="#334155" rotation={[0, 0, -0.35]} />
        <SpherePart position={[-0.55, 0.88, 0]} radius={0.11} color="#1e293b" />
        <CylinderPart position={[-0.3, 0.6, 0]} radius={0.1} height={0.08} color="#64748b" />
        {[-0.05, 0.16, 0.37].map((x, index) => (
          <group key={x}>
            <CylinderPart position={[x, 0.68, -0.05]} radius={0.045} height={0.28} color={['#38bdf8', '#f472b6', '#a3e635'][index]} />
            <CylinderPart position={[x, 0.53, -0.05]} radius={0.065} height={0.04} color="#475569" />
          </group>
        ))}
        <BoxPart position={[0.6, 0.85, -0.45]} size={[0.45, 0.5, 0.08]} color="#0f172a" />
        <BoxPart position={[0.6, 0.85, -0.4]} size={[0.34, 0.38, 0.02]} color="#22d3ee" metalness={0.2} />
      </group>
    );
  }

  return (
    <group>
      <BoxPart position={[0, 0.08, 0]} size={[2, 0.16, 1.65]} color="#64748b" />
      <BoxPart position={[0, 0.66, -0.55]} size={[1.85, 1.0, 0.48]} color="#e2e8f0" />
      <BoxPart position={[-0.4, 0.55, -0.29]} size={[0.62, 0.72, 0.08]} color="#334155" />
      <BoxPart position={[0.45, 0.55, -0.29]} size={[0.62, 0.72, 0.08]} color="#334155" />
      <BoxPart position={[-0.4, 0.19, 0.18]} size={[0.72, 0.12, 0.72]} color="#94a3b8" />
      {[-0.58, -0.34].map((x) => (
        <group key={x}>
          <BoxPart position={[x, 0.38, 0.2]} size={[0.2, 0.24, 0.22]} color="#b45309" />
          <BoxPart position={[x, 0.5, 0.2]} size={[0.22, 0.02, 0.24]} color="#f59e0b" />
        </group>
      ))}
      <BoxPart position={[0.55, 0.23, 0.38]} size={[0.66, 0.38, 0.4]} color="#2563eb" />
      <Wheel position={[0.35, 0.08, 0.59]} radius={0.12} />
      <Wheel position={[0.72, 0.08, 0.59]} radius={0.12} />
    </group>
  );
}

function PreparationModel({ kind }: { kind: 'wash' | 'clean' }) {
  if (kind === 'clean') {
    return (
      <group>
        <BoxPart position={[0, 0.05, 0]} size={[1.9, 0.1, 1.45]} color="#d6b879" />
        <ConePart position={[-0.55, 0.82, 0]} radius={0.43} height={0.72} color="#a16207" rotation={[Math.PI, 0, 0]} />
        <BoxPart position={[0.2, 0.62, 0]} size={[0.75, 0.85, 0.7]} color="#64748b" metalness={0.55} />
        {[-0.18, 0.02, 0.22].map((y) => <BoxPart key={y} position={[0.2, 0.62 + y, 0.36]} size={[0.58, 0.055, 0.04]} color="#cbd5e1" />)}
        <CylinderPart position={[0.68, 0.8, 0]} radius={0.09} height={0.82} color="#475569" />
        <CylinderPart position={[0.66, 1.16, -0.24]} radius={0.07} height={0.52} color="#475569" rotation={[Math.PI / 2, 0, 0]} />
        {[-0.65, -0.45, -0.25].map((x) => <SpherePart key={x} position={[x, 0.12, 0.5]} radius={0.055} color="#eab308" />)}
      </group>
    );
  }
  return (
    <group>
      <BoxPart position={[0, 0.04, 0]} size={[1.95, 0.08, 1.35]} color="#bae6fd" />
      <BoxPart position={[0, 0.28, 0]} size={[1.75, 0.42, 0.72]} color="#64748b" metalness={0.55} />
      <BoxPart position={[0, 0.51, 0]} size={[1.65, 0.04, 0.58]} color="#075985" />
      {[-0.6, -0.2, 0.2, 0.6].map((x) => (
        <group key={x}>
          <CylinderPart position={[x, 0.9, 0]} radius={0.025} height={0.72} color="#334155" />
          <ConePart position={[x, 0.55, 0]} radius={0.1} height={0.16} color="#38bdf8" rotation={[Math.PI, 0, 0]} />
          <SpherePart position={[x - 0.05, 0.62, 0.05]} radius={0.035} color="#7dd3fc" />
        </group>
      ))}
      {[-0.55, -0.2, 0.15, 0.5].map((x) => <SpherePart key={x} position={[x, 0.59, 0]} radius={0.09} color={x > 0 ? '#ef4444' : '#84cc16'} />)}
    </group>
  );
}

function StorageModel({ kind }: { kind: 'silo' | 'cold' | 'warehouse' }) {
  if (kind === 'cold') {
    return (
      <group>
        <BoxPart position={[0, 0.58, 0]} size={[1.85, 1.15, 1.4]} color="#e0f2fe" metalness={0.2} roughness={0.35} />
        <BoxPart position={[0, 0.61, 0.71]} size={[0.7, 0.84, 0.05]} color="#94a3b8" metalness={0.7} />
        <BoxPart position={[0, 0.61, 0.75]} size={[0.5, 0.65, 0.02]} color="#bae6fd" />
        {[-0.55, 0.55].map((x) => (
          <group key={x} position={[x, 0.85, -0.72]}>
            <CylinderPart position={[0, 0, 0]} radius={0.23} height={0.08} color="#475569" rotation={[Math.PI / 2, 0, 0]} />
            {[0, Math.PI / 2].map((r) => <BoxPart key={r} position={[0, 0, -0.05]} size={[0.32, 0.035, 0.03]} color="#cbd5e1" rotation={[0, 0, r]} />)}
          </group>
        ))}
        <BoxPart position={[0.65, 1.18, 0.45]} size={[0.08, 0.45, 0.08]} color="#38bdf8" rotation={[0, 0, 0.78]} />
        <BoxPart position={[0.65, 1.18, 0.45]} size={[0.08, 0.45, 0.08]} color="#38bdf8" rotation={[0, 0, -0.78]} />
      </group>
    );
  }

  if (kind === 'warehouse') {
    return (
      <group>
        <BoxPart position={[0, 0.05, 0]} size={[1.95, 0.1, 1.55]} color="#cbd5e1" />
        <BoxPart position={[0, 0.92, -0.68]} size={[1.9, 1.72, 0.12]} color="#f1f5f9" />
        {[-0.72, 0, 0.72].map((x) => (
          <group key={x}>
            <BoxPart position={[x, 0.58, -0.25]} size={[0.08, 1.05, 0.68]} color="#334155" metalness={0.7} />
            {[0.22, 0.52, 0.82].map((y) => <BoxPart key={y} position={[x, y, -0.25]} size={[0.5, 0.045, 0.64]} color="#f59e0b" />)}
            {[0.28, 0.58, 0.88].map((y) => <BoxPart key={y} position={[x, y, -0.25]} size={[0.25, 0.13, 0.3]} color="#b45309" />)}
          </group>
        ))}
        <BoxPart position={[0, 1.62, 0]} size={[2.05, 0.12, 1.55]} color="#475569" rotation={[0.05, 0, 0]} />
      </group>
    );
  }

  return (
    <group>
      <BoxPart position={[0, 0.04, 0]} size={[2, 0.08, 1.55]} color="#cbd5e1" />
      {[-0.58, 0, 0.58].map((x) => (
        <group key={x}>
          <CylinderPart position={[x, 0.78, 0]} radius={0.32} height={1.15} color="#94a3b8" metalness={0.72} roughness={0.25} />
          <ConePart position={[x, 1.52, 0]} radius={0.34} height={0.35} color="#64748b" />
          <ConePart position={[x, 0.12, 0]} radius={0.3} height={0.28} color="#64748b" rotation={[Math.PI, 0, 0]} />
          {[-0.22, 0.22].map((z) => <CylinderPart key={z} position={[x, 0.12, z]} radius={0.025} height={0.35} color="#334155" />)}
        </group>
      ))}
      <BoxPart position={[0, 1.28, -0.38]} size={[1.45, 0.08, 0.08]} color="#0f172a" metalness={0.8} />
      <BoxPart position={[0.86, 0.78, -0.38]} size={[0.1, 1.45, 0.1]} color="#0f172a" metalness={0.8} />
      {[-0.25, 0.02, 0.29, 0.56, 0.83, 1.1].map((y) => <BoxPart key={y} position={[0.9, y, -0.42]} size={[0.22, 0.025, 0.025]} color="#f59e0b" />)}
    </group>
  );
}

function ProcessModel({
  kind,
}: {
  kind: 'mill' | 'plant' | 'mix' | 'pasteurizer' | 'cook' | 'cool' | 'ferment';
}) {
  if (kind === 'plant') {
    return (
      <group>
        <BoxPart position={[0, 0.05, 0]} size={[2, 0.1, 1.55]} color="#94a3b8" />
        <BoxPart position={[-0.15, 0.58, 0]} size={[1.7, 1.05, 1.3]} color="#e2e8f0" />
        {[-0.55, 0, 0.55].map((x) => (
          <BoxPart key={x} position={[x, 1.16, 0]} size={[0.65, 0.14, 1.42]} color="#b91c1c" rotation={[0, 0, -0.16]} />
        ))}
        {[-0.58, -0.18, 0.22].map((x) => <BoxPart key={x} position={[x, 0.65, 0.66]} size={[0.26, 0.32, 0.04]} color="#7dd3fc" opacity={0.72} />)}
        <BoxPart position={[0.62, 0.43, 0.67]} size={[0.4, 0.76, 0.05]} color="#334155" />
        <CylinderPart position={[0.62, 1.45, -0.35]} radius={0.1} height={1.05} color="#475569" metalness={0.6} />
        <CylinderPart position={[0.62, 2.0, -0.35]} radius={0.13} height={0.08} color="#ef4444" />
      </group>
    );
  }

  if (kind === 'mill') {
    return (
      <group>
        <ConePart position={[-0.65, 1.02, 0]} radius={0.42} height={0.72} color="#b45309" rotation={[Math.PI, 0, 0]} />
        {[-0.18, 0.2].map((x) => (
          <group key={x}>
            <CylinderPart position={[x, 0.62, 0]} radius={0.22} height={0.76} color="#64748b" rotation={[Math.PI / 2, 0, 0]} metalness={0.6} />
            <CylinderPart position={[x, 0.62, -0.26]} radius={0.08} height={0.15} color="#334155" rotation={[Math.PI / 2, 0, 0]} />
          </group>
        ))}
        <BoxPart position={[0.02, 0.3, 0]} size={[0.95, 0.55, 0.72]} color="#475569" metalness={0.45} />
        <CylinderPart position={[0.63, 0.7, 0]} radius={0.07} height={0.85} color="#94a3b8" rotation={[0, 0, -0.45]} />
        {[0.45, 0.7].map((x) => <BoxPart key={x} position={[x, 0.16, 0.4]} size={[0.25, 0.3, 0.2]} color="#f1d6a1" />)}
      </group>
    );
  }

  if (kind === 'cool') {
    return (
      <group>
        <BoxPart position={[0, 0.5, 0]} size={[1.75, 0.9, 1.05]} color="#dbeafe" metalness={0.25} />
        <BoxPart position={[0, 0.28, 0.58]} size={[1.85, 0.28, 0.22]} color="#334155" />
        <BoxPart position={[0, 0.44, 0.58]} size={[1.72, 0.035, 0.18]} color="#0ea5e9" />
        {[-0.5, 0, 0.5].map((x) => (
          <group key={x} position={[x, 0.72, 0.54]}>
            <CylinderPart position={[0, 0, 0]} radius={0.2} height={0.06} color="#64748b" rotation={[Math.PI / 2, 0, 0]} />
            {[0, Math.PI / 2].map((r) => <BoxPart key={r} position={[0, 0, 0.04]} size={[0.3, 0.035, 0.02]} color="#e0f2fe" rotation={[0, 0, r]} />)}
          </group>
        ))}
        {[-0.6, -0.2, 0.2, 0.6].map((x) => <BoxPart key={x} position={[x, 0.53, 0.58]} size={[0.14, 0.12, 0.12]} color="#f8fafc" />)}
      </group>
    );
  }

  if (kind === 'ferment') {
    return (
      <group>
        {[-0.55, 0, 0.55].map((x, index) => (
          <group key={x}>
            <CylinderPart position={[x, 0.83, 0]} radius={0.31} height={1.15} color={index === 1 ? '#a78bfa' : '#cbd5e1'} metalness={0.62} roughness={0.22} />
            <ConePart position={[x, 1.55, 0]} radius={0.31} height={0.28} color="#94a3b8" />
            <ConePart position={[x, 0.17, 0]} radius={0.26} height={0.22} color="#94a3b8" rotation={[Math.PI, 0, 0]} />
            <CylinderPart position={[x + 0.2, 1.58, 0]} radius={0.025} height={0.45} color="#475569" />
          </group>
        ))}
        <BoxPart position={[0, 1.18, -0.4]} size={[1.45, 0.08, 0.45]} color="#334155" metalness={0.7} />
        {[-0.7, 0.7].map((x) => <CylinderPart key={x} position={[x, 0.65, -0.4]} radius={0.03} height={1.05} color="#334155" />)}
      </group>
    );
  }

  const tankColor = kind === 'cook' ? '#fca5a5' : '#cbd5e1';
  return (
    <group>
      <CylinderPart position={[-0.35, 0.75, 0]} radius={0.48} height={1.15} color={tankColor} metalness={0.62} roughness={0.2} />
      <ConePart position={[-0.35, 1.5, 0]} radius={0.46} height={0.24} color="#94a3b8" />
      <CylinderPart position={[-0.35, 1.75, 0]} radius={0.04} height={0.55} color="#475569" />
      {kind !== 'cook' && <BoxPart position={[-0.35, 1.48, 0]} size={[0.75, 0.08, 0.08]} color="#334155" metalness={0.7} />}
      {kind === 'pasteurizer' && (
        <>
          <BoxPart position={[0.5, 0.65, 0]} size={[0.5, 0.95, 0.72]} color="#f97316" metalness={0.35} />
          {[-0.22, 0, 0.22].map((z) => <BoxPart key={z} position={[0.78, 0.65, z]} size={[0.03, 0.72, 0.08]} color="#fed7aa" />)}
        </>
      )}
      {kind === 'mix' && (
        <BoxPart position={[0.5, 0.72, 0]} size={[0.48, 0.72, 0.4]} color="#334155" metalness={0.6} />
      )}
      {kind === 'cook' && (
        <>
          <CylinderPart position={[0.45, 0.32, 0]} radius={0.12} height={0.45} color="#ef4444" />
          {[0.12, 0.32, 0.52].map((y) => <SpherePart key={y} position={[-0.35, 1.58 + y, 0]} radius={0.08 + y * 0.04} color="#e2e8f0" />)}
        </>
      )}
      <CylinderPart position={[0.08, 0.35, 0.45]} radius={0.045} height={1.0} color="#0ea5e9" rotation={[0, 0, Math.PI / 2]} />
      <BoxPart position={[0.56, 0.4, 0.42]} size={[0.36, 0.58, 0.18]} color="#1e293b" />
      <BoxPart position={[0.56, 0.53, 0.52]} size={[0.23, 0.18, 0.02]} color="#22d3ee" />
    </group>
  );
}

function PackagingModel({ kind }: { kind: 'fill' | 'pack' }) {
  const products = [-0.62, -0.3, 0.02, 0.34, 0.66];
  return (
    <group>
      <BoxPart position={[0, 0.28, 0]} size={[1.9, 0.4, 0.62]} color="#475569" metalness={0.45} />
      <BoxPart position={[0, 0.51, 0]} size={[1.8, 0.04, 0.5]} color="#172033" />
      {products.map((x) => (
        kind === 'fill'
          ? (
            <group key={x}>
              <CylinderPart position={[x, 0.67, 0]} radius={0.07} height={0.28} color="#67e8f9" metalness={0.1} roughness={0.1} />
              <CylinderPart position={[x, 0.83, 0]} radius={0.035} height={0.05} color="#0e7490" />
            </group>
          )
          : <BoxPart key={x} position={[x, 0.66, 0]} size={[0.22, 0.24, 0.25]} color={x > 0.3 ? '#f59e0b' : '#d97706'} />
      ))}
      {kind === 'fill' ? (
        <>
          <CylinderPart position={[0, 1.45, -0.1]} radius={0.34} height={0.58} color="#94a3b8" metalness={0.7} roughness={0.2} />
          <ConePart position={[0, 1.02, -0.1]} radius={0.3} height={0.28} color="#64748b" rotation={[Math.PI, 0, 0]} />
          {[-0.62, -0.3, 0.02, 0.34, 0.66].map((x) => <CylinderPart key={x} position={[x, 0.94, 0]} radius={0.025} height={0.48} color="#64748b" />)}
        </>
      ) : (
        <>
          <BoxPart position={[-0.2, 0.93, 0]} size={[0.65, 0.62, 0.75]} color="#0d9488" metalness={0.35} />
          <BoxPart position={[-0.2, 1.03, 0.39]} size={[0.26, 0.2, 0.03]} color="#2dd4bf" />
          <BoxPart position={[0.7, 0.17, -0.45]} size={[0.58, 0.12, 0.5]} color="#a16207" />
          {[0.58, 0.82].map((x) => <BoxPart key={x} position={[x, 0.35, -0.45]} size={[0.2, 0.28, 0.22]} color="#b45309" />)}
        </>
      )}
    </group>
  );
}

function TextileModel({ kind }: { kind: 'spin' | 'weave' | 'dye' | 'cut' }) {
  if (kind === 'spin') {
    return (
      <group>
        <BoxPart position={[0, 0.42, 0]} size={[1.8, 0.72, 0.65]} color="#475569" metalness={0.45} />
        {[-0.65, -0.32, 0, 0.32, 0.65].map((x, index) => (
          <group key={x}>
            <ConePart position={[x, 0.92, 0.08]} radius={0.13} height={0.48} color={['#f8fafc', '#f9a8d4', '#c4b5fd', '#67e8f9', '#fde68a'][index]} />
            <CylinderPart position={[x, 0.58, -0.22]} radius={0.1} height={0.16} color="#cbd5e1" rotation={[Math.PI / 2, 0, 0]} metalness={0.6} />
          </group>
        ))}
        <BoxPart position={[0, 1.25, -0.25]} size={[1.75, 0.08, 0.08]} color="#1e293b" />
        {[-0.65, -0.32, 0, 0.32, 0.65].map((x) => <BoxPart key={x} position={[x, 1.0, -0.25]} size={[0.015, 0.48, 0.015]} color="#f8fafc" />)}
      </group>
    );
  }

  if (kind === 'weave') {
    return (
      <group>
        {[-0.82, 0.82].map((x) => <BoxPart key={x} position={[x, 0.72, 0]} size={[0.1, 1.4, 1.05]} color="#334155" metalness={0.6} />)}
        <BoxPart position={[0, 1.38, 0]} size={[1.75, 0.1, 1.05]} color="#334155" />
        {[-0.42, -0.28, -0.14, 0, 0.14, 0.28, 0.42].map((z, index) => (
          <BoxPart key={z} position={[0, 0.82, z]} size={[1.55, 0.018, 0.025]} color={index % 2 ? '#ec4899' : '#6366f1'} />
        ))}
        <CylinderPart position={[-0.58, 0.3, 0]} radius={0.24} height={0.92} color="#f8fafc" rotation={[Math.PI / 2, 0, 0]} />
        <CylinderPart position={[0.58, 0.3, 0]} radius={0.24} height={0.92} color="#a5b4fc" rotation={[Math.PI / 2, 0, 0]} />
      </group>
    );
  }

  if (kind === 'dye') {
    return (
      <group>
        {[-0.55, 0, 0.55].map((x, index) => (
          <group key={x}>
            <CylinderPart position={[x, 0.62, 0]} radius={0.34} height={0.88} color={['#ec4899', '#8b5cf6', '#0ea5e9'][index]} metalness={0.35} roughness={0.25} />
            <CylinderPart position={[x, 1.08, 0]} radius={0.32} height={0.05} color={['#f9a8d4', '#c4b5fd', '#7dd3fc'][index]} />
            <CylinderPart position={[x, 1.35, 0]} radius={0.025} height={0.55} color="#475569" />
          </group>
        ))}
        <CylinderPart position={[0, 0.25, 0.48]} radius={0.045} height={1.5} color="#334155" rotation={[0, 0, Math.PI / 2]} />
        <BoxPart position={[0.72, 0.82, -0.48]} size={[0.35, 0.65, 0.22]} color="#1e293b" />
      </group>
    );
  }

  return (
    <group>
      <BoxPart position={[-0.35, 0.48, 0]} size={[1.15, 0.12, 1.1]} color="#cbd5e1" />
      {[0.05, 0.2, 0.35].map((z, index) => <BoxPart key={z} position={[-0.35, 0.57 + index * 0.015, z]} size={[0.92, 0.02, 0.18]} color={['#a5b4fc', '#f9a8d4', '#67e8f9'][index]} rotation={[0, 0.15 - index * 0.1, 0]} />)}
      <CylinderPart position={[-0.78, 0.78, -0.4]} radius={0.18} height={0.72} color="#f8fafc" rotation={[Math.PI / 2, 0, 0]} />
      <BoxPart position={[0.55, 0.46, 0]} size={[0.55, 0.68, 0.58]} color="#0f766e" />
      <BoxPart position={[0.55, 0.85, 0]} size={[0.35, 0.12, 0.32]} color="#e2e8f0" />
      <CylinderPart position={[0.55, 1.02, 0]} radius={0.035} height={0.32} color="#334155" />
      <BoxPart position={[0.3, 0.22, 0.42]} size={[0.24, 0.35, 0.22]} color="#334155" />
    </group>
  );
}

function LogisticsModel({ kind }: { kind: 'truck' | 'forklift' | 'dc' | 'retail' }) {
  if (kind === 'truck') {
    return (
      <group position={[0, 0.12, 0]}>
        <BoxPart position={[-0.25, 0.46, 0]} size={[1.25, 0.75, 0.72]} color="#f8fafc" metalness={0.15} />
        <BoxPart position={[0.62, 0.38, 0]} size={[0.52, 0.62, 0.72]} color="#2563eb" />
        <BoxPart position={[0.75, 0.53, 0.37]} size={[0.25, 0.23, 0.03]} color="#7dd3fc" opacity={0.8} />
        <BoxPart position={[0, 0.12, 0]} size={[1.75, 0.12, 0.62]} color="#334155" metalness={0.7} />
        {[-0.62, -0.1, 0.52].flatMap((x) => [-0.39, 0.39].map((z) => <Wheel key={`${x}-${z}`} position={[x, -0.02, z]} />))}
        <BoxPart position={[-0.88, 0.47, 0]} size={[0.04, 0.58, 0.62]} color="#cbd5e1" />
        <BoxPart position={[0.62, 0.38, 0.37]} size={[0.42, 0.12, 0.03]} color="#1d4ed8" />
      </group>
    );
  }

  if (kind === 'forklift') {
    return (
      <group>
        <BoxPart position={[-0.15, 0.25, 0]} size={[0.85, 0.35, 0.62]} color="#eab308" />
        <BoxPart position={[-0.28, 0.62, 0]} size={[0.45, 0.58, 0.55]} color="#facc15" />
        <BoxPart position={[-0.25, 0.72, 0.29]} size={[0.3, 0.26, 0.03]} color="#7dd3fc" />
        <Wheel position={[-0.42, 0.08, -0.34]} />
        <Wheel position={[-0.42, 0.08, 0.34]} />
        <Wheel position={[0.18, 0.08, -0.32]} radius={0.12} />
        <Wheel position={[0.18, 0.08, 0.32]} radius={0.12} />
        {[0.38, 0.58].map((x) => <BoxPart key={x} position={[x, 0.72, 0]} size={[0.07, 1.25, 0.08]} color="#334155" />)}
        {[-0.16, 0.16].map((z) => <BoxPart key={z} position={[0.86, 0.13, z]} size={[0.95, 0.06, 0.08]} color="#334155" />)}
        <BoxPart position={[0.8, 0.22, 0]} size={[0.5, 0.1, 0.52]} color="#a16207" />
      </group>
    );
  }

  const retail = kind === 'retail';
  return (
    <group>
      <BoxPart position={[0, 0.58, -0.1]} size={[1.9, 1.15, 1.35]} color={retail ? '#f8fafc' : '#dbeafe'} />
      <BoxPart position={[0, 1.22, -0.1]} size={[2, 0.15, 1.45]} color={retail ? '#475569' : '#0f766e'} />
      {retail ? (
        <>
          <BoxPart position={[0, 0.75, 0.59]} size={[1.65, 0.12, 0.38]} color="#ea580c" rotation={[0.28, 0, 0]} />
          <BoxPart position={[0, 0.4, 0.59]} size={[1.25, 0.65, 0.04]} color="#bae6fd" opacity={0.68} />
          {[-0.5, 0, 0.5].map((x) => <BoxPart key={x} position={[x, 0.24, 0.65]} size={[0.28, 0.35, 0.22]} color="#f59e0b" />)}
        </>
      ) : (
        <>
          {[-0.58, 0, 0.58].map((x) => (
            <group key={x}>
              <BoxPart position={[x, 0.46, 0.59]} size={[0.46, 0.72, 0.05]} color="#334155" />
              <BoxPart position={[x, 0.12, 0.8]} size={[0.5, 0.08, 0.48]} color="#94a3b8" />
            </group>
          ))}
          <BoxPart position={[0, 1.38, 0.25]} size={[1.25, 0.14, 0.14]} color="#0f766e" />
        </>
      )}
    </group>
  );
}

function UtilityModel({ kind }: { kind: 'water' | 'waste' }) {
  const water = kind === 'water';
  return (
    <group>
      <BoxPart position={[0, 0.04, 0]} size={[1.95, 0.08, 1.45]} color={water ? '#bae6fd' : '#bbf7d0'} />
      {[-0.55, 0.05, 0.62].map((x, index) => (
        <group key={x}>
          <CylinderPart position={[x, 0.48, index === 1 ? -0.25 : 0]} radius={index === 1 ? 0.32 : 0.4} height={index === 1 ? 0.82 : 0.55} color={water ? ['#0ea5e9', '#64748b', '#38bdf8'][index] : ['#16a34a', '#64748b', '#4ade80'][index]} metalness={0.25} />
          <CylinderPart position={[x, 0.77, index === 1 ? -0.25 : 0]} radius={index === 1 ? 0.28 : 0.36} height={0.03} color={water ? '#7dd3fc' : '#86efac'} />
        </group>
      ))}
      <CylinderPart position={[0.02, 0.25, 0.5]} radius={0.045} height={1.25} color="#334155" rotation={[0, 0, Math.PI / 2]} />
      <BoxPart position={[-0.05, 0.88, -0.58]} size={[0.7, 0.55, 0.3]} color="#475569" />
      {[-0.25, 0.05, 0.35].map((x) => <CylinderPart key={x} position={[x, 1.22, -0.58]} radius={0.04} height={0.35} color="#64748b" />)}
    </group>
  );
}

export function IndustrialStepModel({
  visualModel,
  category,
}: {
  visualModel?: string | null;
  category: StepCategory;
}) {
  const model = resolveVisualModel(visualModel, category);
  switch (model) {
    case 'FARM_FIELD': return <AgricultureModel kind="field" />;
    case 'GREENHOUSE': return <AgricultureModel kind="greenhouse" />;
    case 'HARVESTER': return <AgricultureModel kind="harvester" />;
    case 'RECEIVING_DOCK': return <ReceivingControlModel kind="dock" />;
    case 'WEIGHBRIDGE': return <ReceivingControlModel kind="scale" />;
    case 'QUALITY_LAB': return <ReceivingControlModel kind="lab" />;
    case 'WASHING_LINE': return <PreparationModel kind="wash" />;
    case 'GRAIN_CLEANER': return <PreparationModel kind="clean" />;
    case 'SILO_COMPLEX': return <StorageModel kind="silo" />;
    case 'COLD_STORAGE': return <StorageModel kind="cold" />;
    case 'WAREHOUSE': return <StorageModel kind="warehouse" />;
    case 'MILLING': return <ProcessModel kind="mill" />;
    case 'PROCESSING_PLANT': return <ProcessModel kind="plant" />;
    case 'MIXING_TANK': return <ProcessModel kind="mix" />;
    case 'PASTEURIZER': return <ProcessModel kind="pasteurizer" />;
    case 'COOKING_KETTLE': return <ProcessModel kind="cook" />;
    case 'COOLING_TUNNEL': return <ProcessModel kind="cool" />;
    case 'FERMENTATION_TANKS': return <ProcessModel kind="ferment" />;
    case 'FILLING_LINE': return <PackagingModel kind="fill" />;
    case 'PACKAGING_LINE': return <PackagingModel kind="pack" />;
    case 'TEXTILE_SPINNING': return <TextileModel kind="spin" />;
    case 'TEXTILE_WEAVING': return <TextileModel kind="weave" />;
    case 'TEXTILE_DYEING': return <TextileModel kind="dye" />;
    case 'TEXTILE_CUT_SEW': return <TextileModel kind="cut" />;
    case 'TRUCK': return <LogisticsModel kind="truck" />;
    case 'FORKLIFT': return <LogisticsModel kind="forklift" />;
    case 'DISTRIBUTION_CENTER': return <LogisticsModel kind="dc" />;
    case 'RETAIL_STORE': return <LogisticsModel kind="retail" />;
    case 'WATER_TREATMENT': return <UtilityModel kind="water" />;
    case 'WASTE_TREATMENT': return <UtilityModel kind="waste" />;
  }
}

export interface FlowTemplateStep {
  name: string;
  type: StepCategory;
  visualModel: VisualModelId;
  description: string;
  inputs?: string;
  outputs?: string;
  isControlPoint?: boolean;
}

export interface FlowTemplate {
  id: string;
  name: string;
  sector: string;
  summary: string;
  color: string;
  steps: FlowTemplateStep[];
}

const step = (
  name: string,
  type: StepCategory,
  visualModel: VisualModelId,
  description: string,
  inputs?: string,
  outputs?: string,
  isControlPoint = false,
): FlowTemplateStep => ({ name, type, visualModel, description, inputs, outputs, isControlPoint });

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: 'farm-to-table',
    name: 'Do campo ao varejo',
    sector: 'Cadeia de alimentos',
    summary: 'Ciclo completo, da produção primária até o consumidor.',
    color: '#65a30d',
    steps: [
      step('Planejamento da lavoura', 'OTHER', 'FARM_FIELD', 'Definição de talhões, sementes, insumos e controles agrícolas.', 'Sementes, solo, plano de cultivo', 'Lavoura implantada'),
      step('Cultivo e irrigação', 'OTHER', 'FARM_FIELD', 'Manejo da cultura, irrigação e controle de pragas.', 'Água e insumos aprovados', 'Cultura pronta para colheita', true),
      step('Colheita', 'TRANSPORT', 'HARVESTER', 'Colheita mecanizada e segregação inicial do produto.', 'Cultura madura', 'Produto agrícola colhido'),
      step('Transporte primário', 'TRANSPORT', 'TRUCK', 'Movimentação da fazenda até a unidade de beneficiamento.', 'Carga identificada', 'Matéria-prima recebida'),
      step('Pesagem e recebimento', 'RECEIVING', 'WEIGHBRIDGE', 'Conferência documental, pesagem e inspeção da carga.', 'Carga e documentos', 'Lote recebido'),
      step('Amostragem e qualidade', 'OTHER', 'QUALITY_LAB', 'Análises de conformidade, resíduos e condição higiênica.', 'Amostra do lote', 'Laudo de liberação', true),
      step('Lavagem e seleção', 'PROCESSING', 'WASHING_LINE', 'Remoção de sujidades e seleção por padrão de qualidade.', 'Produto bruto e água potável', 'Produto limpo e selecionado'),
      step('Processamento', 'PROCESSING', 'PROCESSING_PLANT', 'Transformação conforme formulação e parâmetros do produto.', 'Matéria-prima liberada', 'Produto processado'),
      step('Tratamento térmico', 'PROCESSING', 'PASTEURIZER', 'Redução de perigos por tempo e temperatura controlados.', 'Produto em processo', 'Produto tratado', true),
      step('Resfriamento', 'PROCESSING', 'COOLING_TUNNEL', 'Redução rápida da temperatura para evitar crescimento microbiano.', 'Produto quente', 'Produto resfriado', true),
      step('Embalagem', 'PACKAGING', 'PACKAGING_LINE', 'Proteção, identificação, rotulagem e formação do lote.', 'Produto e embalagem', 'Produto acabado'),
      step('Armazenamento final', 'STORAGE', 'COLD_STORAGE', 'Conservação nas condições especificadas.', 'Produto acabado', 'Estoque liberado'),
      step('Expedição', 'DISTRIBUTION', 'DISTRIBUTION_CENTER', 'Separação de pedidos e controle da cadeia logística.', 'Pedidos e estoque', 'Carga expedida'),
      step('Distribuição', 'TRANSPORT', 'TRUCK', 'Transporte ao mercado com controle de integridade e temperatura.', 'Carga expedida', 'Produto entregue'),
      step('Varejo', 'DISTRIBUTION', 'RETAIL_STORE', 'Exposição, conservação e disponibilização ao consumidor.', 'Produto entregue', 'Produto comercializado'),
    ],
  },
  {
    id: 'grains-flour',
    name: 'Grãos, farinha e derivados',
    sector: 'Cerealista / Moinho',
    summary: 'Lavoura, secagem, silos, moagem, mistura e distribuição.',
    color: '#d97706',
    steps: [
      step('Lavoura de grãos', 'OTHER', 'FARM_FIELD', 'Produção agrícola com manejo e rastreabilidade.', 'Sementes e insumos', 'Grãos em campo'),
      step('Colheita mecanizada', 'TRANSPORT', 'HARVESTER', 'Colheita e limpeza inicial.', 'Grãos maduros', 'Grãos colhidos'),
      step('Transporte para unidade', 'TRANSPORT', 'TRUCK', 'Transporte identificado por origem e talhão.', 'Grãos colhidos', 'Carga na unidade'),
      step('Pesagem e classificação', 'RECEIVING', 'WEIGHBRIDGE', 'Pesagem, umidade, impurezas e classificação.', 'Carga de grãos', 'Lote classificado', true),
      step('Pré-limpeza', 'PROCESSING', 'GRAIN_CLEANER', 'Remoção de palhas, pedras, metais e impurezas.', 'Grão recebido', 'Grão limpo'),
      step('Secagem', 'PROCESSING', 'PROCESSING_PLANT', 'Redução controlada da umidade.', 'Grão úmido', 'Grão seco', true),
      step('Armazenagem em silos', 'STORAGE', 'SILO_COMPLEX', 'Aeração, termometria e segregação por lote.', 'Grão seco', 'Grão armazenado', true),
      step('Moagem', 'PROCESSING', 'MILLING', 'Ruptura e separação granulométrica.', 'Grão liberado', 'Farinha e frações'),
      step('Mistura e fortificação', 'PROCESSING', 'MIXING_TANK', 'Homogeneização e adição controlada de ingredientes.', 'Farinha e aditivos', 'Produto formulado', true),
      step('Controle laboratorial', 'OTHER', 'QUALITY_LAB', 'Ensaios físico-químicos e microbiológicos.', 'Amostra do produto', 'Laudo de liberação'),
      step('Ensaque e paletização', 'PACKAGING', 'PACKAGING_LINE', 'Dosagem, fechamento, identificação e pallet.', 'Produto formulado', 'Produto ensacado'),
      step('Armazém de acabados', 'STORAGE', 'WAREHOUSE', 'Segregação e FEFO/FIFO.', 'Produto ensacado', 'Estoque disponível'),
      step('Expedição', 'DISTRIBUTION', 'DISTRIBUTION_CENTER', 'Separação, conferência e carregamento.', 'Pedido', 'Carga expedida'),
    ],
  },
  {
    id: 'dairy',
    name: 'Leite e derivados',
    sector: 'Laticínios',
    summary: 'Ordenha, cadeia fria, pasteurização, envase e distribuição.',
    color: '#0284c7',
    steps: [
      step('Produção leiteira', 'OTHER', 'FARM_FIELD', 'Manejo animal, alimentação, higiene e controle veterinário.', 'Rebanho e alimentação', 'Leite cru'),
      step('Ordenha e filtração', 'PROCESSING', 'MIXING_TANK', 'Ordenha higiênica e filtração inicial.', 'Leite cru', 'Leite filtrado', true),
      step('Resfriamento na fazenda', 'STORAGE', 'COLD_STORAGE', 'Resfriamento imediato e conservação no tanque.', 'Leite filtrado', 'Leite refrigerado', true),
      step('Coleta refrigerada', 'TRANSPORT', 'TRUCK', 'Coleta por rota com identificação de produtores.', 'Leite refrigerado', 'Carga composta'),
      step('Recepção e análises', 'RECEIVING', 'QUALITY_LAB', 'Amostragem, antibióticos, acidez e composição.', 'Leite recebido', 'Leite aprovado', true),
      step('Armazenagem do leite cru', 'STORAGE', 'SILO_COMPLEX', 'Tanques pulmão refrigerados e segregados.', 'Leite aprovado', 'Leite para processo'),
      step('Padronização', 'PROCESSING', 'MIXING_TANK', 'Ajuste de gordura e sólidos.', 'Leite cru', 'Leite padronizado'),
      step('Pasteurização', 'PROCESSING', 'PASTEURIZER', 'Tratamento térmico com registro contínuo.', 'Leite padronizado', 'Leite pasteurizado', true),
      step('Fermentação / formulação', 'PROCESSING', 'FERMENTATION_TANKS', 'Culturas, ingredientes e tempo controlado.', 'Leite pasteurizado', 'Derivado formulado', true),
      step('Resfriamento', 'PROCESSING', 'COOLING_TUNNEL', 'Interrupção da fermentação e estabilização.', 'Produto fermentado', 'Produto resfriado'),
      step('Envase higiênico', 'PACKAGING', 'FILLING_LINE', 'Envase, fechamento e codificação.', 'Produto resfriado', 'Produto envasado', true),
      step('Câmara fria', 'STORAGE', 'COLD_STORAGE', 'Conservação e gestão de validade.', 'Produto envasado', 'Produto liberado'),
      step('Distribuição refrigerada', 'TRANSPORT', 'TRUCK', 'Entrega preservando a cadeia de frio.', 'Produto liberado', 'Produto entregue'),
      step('Varejo refrigerado', 'DISTRIBUTION', 'RETAIL_STORE', 'Exposição e conservação até a venda.', 'Produto entregue', 'Produto ao consumidor'),
    ],
  },
  {
    id: 'meat',
    name: 'Carnes e frigorífico',
    sector: 'Frigorífico',
    summary: 'Recepção animal, abate, inspeção, resfriamento e expedição.',
    color: '#dc2626',
    steps: [
      step('Produção pecuária', 'OTHER', 'FARM_FIELD', 'Origem, alimentação, sanidade e rastreabilidade animal.', 'Animais e registros', 'Lote apto'),
      step('Transporte de animais', 'TRANSPORT', 'TRUCK', 'Transporte controlado até o estabelecimento.', 'Lote animal', 'Animais recebidos'),
      step('Recepção e currais', 'RECEIVING', 'RECEIVING_DOCK', 'Identificação, inspeção ante mortem e descanso.', 'Animais e documentos', 'Lote liberado', true),
      step('Abate humanitário', 'PROCESSING', 'PROCESSING_PLANT', 'Insensibilização e sangria sob parâmetros controlados.', 'Animal liberado', 'Carcaça em processo', true),
      step('Evisceração', 'PROCESSING', 'PROCESSING_PLANT', 'Remoção de vísceras com prevenção de contaminação.', 'Carcaça', 'Carcaça e vísceras', true),
      step('Inspeção sanitária', 'OTHER', 'QUALITY_LAB', 'Inspeção post mortem e segregação de não conformes.', 'Carcaça e vísceras', 'Carcaça aprovada', true),
      step('Lavagem de carcaças', 'PROCESSING', 'WASHING_LINE', 'Limpeza conforme procedimento validado.', 'Carcaça aprovada', 'Carcaça limpa'),
      step('Resfriamento de carcaças', 'PROCESSING', 'COOLING_TUNNEL', 'Redução de temperatura em tempo controlado.', 'Carcaça limpa', 'Carcaça resfriada', true),
      step('Desossa e cortes', 'PROCESSING', 'PROCESSING_PLANT', 'Desossa, toalete e padronização dos cortes.', 'Carcaça resfriada', 'Cortes cárneos'),
      step('Embalagem', 'PACKAGING', 'PACKAGING_LINE', 'Embalagem primária, vácuo e identificação.', 'Cortes', 'Cortes embalados'),
      step('Congelamento / estocagem', 'STORAGE', 'COLD_STORAGE', 'Conservação resfriada ou congelada.', 'Cortes embalados', 'Produto acabado', true),
      step('Expedição frigorificada', 'DISTRIBUTION', 'DISTRIBUTION_CENTER', 'Separação e carregamento sob temperatura.', 'Produto acabado', 'Carga expedida'),
      step('Distribuição refrigerada', 'TRANSPORT', 'TRUCK', 'Transporte e registro da cadeia de frio.', 'Carga expedida', 'Produto entregue'),
    ],
  },
  {
    id: 'beverages',
    name: 'Bebidas e envase',
    sector: 'Bebidas',
    summary: 'Água, ingredientes, preparo, tratamento térmico e envase.',
    color: '#0891b2',
    steps: [
      step('Captação e tratamento de água', 'OTHER', 'WATER_TREATMENT', 'Filtração, desinfecção e controle da água de processo.', 'Água bruta', 'Água potável', true),
      step('Recebimento de ingredientes', 'RECEIVING', 'RECEIVING_DOCK', 'Conferência e amostragem de insumos.', 'Ingredientes', 'Lotes recebidos'),
      step('Armazenamento de insumos', 'STORAGE', 'WAREHOUSE', 'Segregação por condição e validade.', 'Lotes recebidos', 'Insumos liberados'),
      step('Pesagem e dosagem', 'PROCESSING', 'QUALITY_LAB', 'Dosagem conforme formulação aprovada.', 'Insumos', 'Carga dosada', true),
      step('Preparo e mistura', 'PROCESSING', 'MIXING_TANK', 'Dissolução e homogeneização.', 'Carga e água', 'Bebida preparada'),
      step('Tratamento térmico', 'PROCESSING', 'PASTEURIZER', 'Pasteurização ou esterilização conforme produto.', 'Bebida preparada', 'Bebida tratada', true),
      step('Resfriamento', 'PROCESSING', 'COOLING_TUNNEL', 'Ajuste de temperatura para envase.', 'Bebida tratada', 'Bebida resfriada'),
      step('Preparação de embalagens', 'PACKAGING', 'WASHING_LINE', 'Inspeção, lavagem ou sanitização das embalagens.', 'Embalagens vazias', 'Embalagens preparadas', true),
      step('Envase', 'PACKAGING', 'FILLING_LINE', 'Dosagem, fechamento e inspeção em linha.', 'Bebida e embalagem', 'Unidades envasadas', true),
      step('Rotulagem e embalagem', 'PACKAGING', 'PACKAGING_LINE', 'Codificação, rotulagem e formação de caixas.', 'Unidades envasadas', 'Produto acabado'),
      step('Armazém de acabados', 'STORAGE', 'WAREHOUSE', 'Quarentena e liberação de lotes.', 'Produto acabado', 'Estoque liberado'),
      step('Centro de distribuição', 'DISTRIBUTION', 'DISTRIBUTION_CENTER', 'Separação de pedidos e expedição.', 'Estoque liberado', 'Pedidos expedidos'),
    ],
  },
  {
    id: 'bakery',
    name: 'Panificação industrial',
    sector: 'Padaria / Massas',
    summary: 'Farinha, mistura, fermentação, forno, resfriamento e embalagem.',
    color: '#b45309',
    steps: [
      step('Recebimento de matérias-primas', 'RECEIVING', 'RECEIVING_DOCK', 'Conferência de farinha, fermento e demais ingredientes.', 'Ingredientes', 'Lotes recebidos'),
      step('Armazenamento seco', 'STORAGE', 'WAREHOUSE', 'Estocagem protegida e controle de alergênicos.', 'Lotes recebidos', 'Ingredientes disponíveis', true),
      step('Peneiramento e dosagem', 'PROCESSING', 'GRAIN_CLEANER', 'Remoção de corpos estranhos e dosagem.', 'Farinha e ingredientes', 'Carga dosada', true),
      step('Mistura e amassamento', 'PROCESSING', 'MIXING_TANK', 'Desenvolvimento da massa conforme receita.', 'Carga dosada', 'Massa pronta'),
      step('Fermentação', 'PROCESSING', 'FERMENTATION_TANKS', 'Controle de tempo, umidade e temperatura.', 'Massa modelada', 'Massa fermentada'),
      step('Forneamento', 'PROCESSING', 'COOKING_KETTLE', 'Cocção com parâmetros críticos definidos.', 'Massa fermentada', 'Produto assado', true),
      step('Resfriamento', 'PROCESSING', 'COOLING_TUNNEL', 'Resfriamento protegido antes da embalagem.', 'Produto assado', 'Produto resfriado', true),
      step('Fatiamento', 'PROCESSING', 'PROCESSING_PLANT', 'Corte e inspeção do produto.', 'Produto resfriado', 'Produto fatiado'),
      step('Embalagem', 'PACKAGING', 'PACKAGING_LINE', 'Embalagem, detecção e codificação.', 'Produto fatiado', 'Produto acabado', true),
      step('Armazenamento final', 'STORAGE', 'WAREHOUSE', 'Gestão por validade e lote.', 'Produto acabado', 'Estoque liberado'),
      step('Distribuição', 'TRANSPORT', 'TRUCK', 'Transporte e proteção contra danos.', 'Estoque liberado', 'Produto entregue'),
    ],
  },
  {
    id: 'manufacturing',
    name: 'Indústria de transformação',
    sector: 'Manufatura',
    summary: 'Recebimento, transformação, controle em processo, acabamento e expedição.',
    color: '#475569',
    steps: [
      step('Recebimento de matérias-primas', 'RECEIVING', 'RECEIVING_DOCK', 'Descarga, identificação, conferência documental e segregação inicial.', 'Matérias-primas e documentos', 'Materiais recebidos'),
      step('Inspeção de recebimento', 'OTHER', 'QUALITY_LAB', 'Amostragem, ensaios e decisão de liberação do lote.', 'Materiais recebidos', 'Lotes aprovados ou bloqueados', true),
      step('Armazenamento de insumos', 'STORAGE', 'WAREHOUSE', 'Endereçamento, preservação e controle FIFO/FEFO.', 'Lotes liberados', 'Insumos disponíveis'),
      step('Preparação da produção', 'PROCESSING', 'PROCESSING_PLANT', 'Separação, pesagem, setup e liberação dos recursos produtivos.', 'Ordem de produção e insumos', 'Linha preparada'),
      step('Transformação primária', 'PROCESSING', 'PROCESSING_PLANT', 'Conversão principal da matéria-prima conforme parâmetros definidos.', 'Insumos preparados', 'Produto em processo'),
      step('Mistura ou montagem', 'PROCESSING', 'MIXING_TANK', 'Composição, montagem ou integração dos componentes do produto.', 'Componentes processados', 'Produto montado'),
      step('Controle em processo', 'OTHER', 'QUALITY_LAB', 'Medições dimensionais, funcionais ou físico-químicas durante a fabricação.', 'Amostras do processo', 'Processo liberado', true),
      step('Acabamento', 'PROCESSING', 'COOLING_TUNNEL', 'Estabilização, resfriamento, acabamento superficial ou cura.', 'Produto em processo', 'Produto acabado'),
      step('Inspeção final', 'OTHER', 'QUALITY_LAB', 'Verificação final contra especificação e critérios de aceitação.', 'Produto acabado', 'Produto aprovado', true),
      step('Embalagem e identificação', 'PACKAGING', 'PACKAGING_LINE', 'Proteção, etiquetagem, rastreabilidade e paletização.', 'Produto aprovado e embalagens', 'Unidades logísticas'),
      step('Armazém de produto acabado', 'STORAGE', 'WAREHOUSE', 'Preservação e controle do estoque disponível para venda.', 'Unidades logísticas', 'Estoque expedível'),
      step('Centro de distribuição', 'DISTRIBUTION', 'DISTRIBUTION_CENTER', 'Separação, conferência e consolidação das cargas.', 'Pedidos e estoque', 'Cargas expedidas'),
      step('Transporte ao cliente', 'TRANSPORT', 'TRUCK', 'Entrega com controle de integridade, prazo e comprovantes.', 'Cargas expedidas', 'Pedidos entregues'),
      step('Tratamento de resíduos', 'OTHER', 'WASTE_TREATMENT', 'Segregação, tratamento e destinação dos resíduos e efluentes.', 'Resíduos do processo', 'Material tratado e registros', true),
    ],
  },
  {
    id: 'fresh-produce',
    name: 'Hortifruti minimamente processado',
    sector: 'Hortifruti',
    summary: 'Cultivo, lavagem, sanitização, corte e cadeia refrigerada.',
    color: '#16a34a',
    steps: [
      step('Cultivo protegido', 'OTHER', 'GREENHOUSE', 'Manejo, irrigação e controle de insumos.', 'Mudas e água', 'Hortaliças prontas', true),
      step('Colheita', 'TRANSPORT', 'HARVESTER', 'Colheita higiênica e formação de lotes.', 'Hortaliças', 'Produto colhido'),
      step('Transporte à unidade', 'TRANSPORT', 'TRUCK', 'Transporte rápido e protegido.', 'Produto colhido', 'Produto recebido'),
      step('Recepção e triagem', 'RECEIVING', 'RECEIVING_DOCK', 'Conferência, inspeção visual e segregação.', 'Produto recebido', 'Produto selecionado'),
      step('Pré-lavagem', 'PROCESSING', 'WASHING_LINE', 'Remoção inicial de solo e sujidades.', 'Produto selecionado', 'Produto pré-lavado'),
      step('Sanitização', 'PROCESSING', 'WASHING_LINE', 'Concentração e tempo de contato controlados.', 'Produto pré-lavado', 'Produto sanitizado', true),
      step('Corte e preparo', 'PROCESSING', 'PROCESSING_PLANT', 'Corte higiênico sob ambiente controlado.', 'Produto sanitizado', 'Produto preparado', true),
      step('Centrifugação e resfriamento', 'PROCESSING', 'COOLING_TUNNEL', 'Remoção de água e redução da temperatura.', 'Produto preparado', 'Produto refrigerado'),
      step('Embalagem em atmosfera controlada', 'PACKAGING', 'PACKAGING_LINE', 'Selagem e identificação do lote.', 'Produto refrigerado', 'Produto embalado', true),
      step('Câmara fria', 'STORAGE', 'COLD_STORAGE', 'Conservação até expedição.', 'Produto embalado', 'Produto liberado'),
      step('Distribuição refrigerada', 'TRANSPORT', 'TRUCK', 'Transporte preservando temperatura.', 'Produto liberado', 'Produto entregue'),
    ],
  },
  {
    id: 'textile',
    name: 'Ciclo têxtil completo',
    sector: 'Indústria têxtil',
    summary: 'Algodão, fiação, tecelagem, tingimento, acabamento e confecção.',
    color: '#7c3aed',
    steps: [
      step('Lavoura de algodão', 'OTHER', 'FARM_FIELD', 'Cultivo, manejo e rastreabilidade da fibra.', 'Sementes e insumos', 'Algodão em campo'),
      step('Colheita do algodão', 'TRANSPORT', 'HARVESTER', 'Colheita mecanizada e formação dos fardos.', 'Algodão maduro', 'Algodão colhido'),
      step('Recepção e pesagem', 'RECEIVING', 'WEIGHBRIDGE', 'Pesagem, identificação e classificação.', 'Fardos de algodão', 'Lote recebido'),
      step('Beneficiamento da fibra', 'PROCESSING', 'GRAIN_CLEANER', 'Separação de impurezas, caroço e fibra.', 'Algodão bruto', 'Fibra beneficiada'),
      step('Armazenagem de fibras', 'STORAGE', 'WAREHOUSE', 'Segregação por qualidade e lote.', 'Fibra beneficiada', 'Fibra disponível'),
      step('Fiação', 'PROCESSING', 'TEXTILE_SPINNING', 'Cardagem, estiragem, torção e formação de cones.', 'Fibras', 'Fios'),
      step('Tecelagem', 'PROCESSING', 'TEXTILE_WEAVING', 'Urdimento e entrelaçamento dos fios.', 'Fios', 'Tecido cru'),
      step('Pré-tratamento', 'PROCESSING', 'WASHING_LINE', 'Lavagem, desengomagem e preparação do tecido.', 'Tecido cru', 'Tecido preparado'),
      step('Tingimento', 'PROCESSING', 'TEXTILE_DYEING', 'Aplicação e fixação do corante.', 'Tecido preparado e corantes', 'Tecido tingido', true),
      step('Lavagem e acabamento', 'PROCESSING', 'TEXTILE_DYEING', 'Remoção de excedentes, secagem e acabamento.', 'Tecido tingido', 'Tecido acabado', true),
      step('Inspeção de qualidade', 'OTHER', 'QUALITY_LAB', 'Verificação de cor, resistência e defeitos.', 'Tecido acabado', 'Tecido aprovado'),
      step('Corte e costura', 'PROCESSING', 'TEXTILE_CUT_SEW', 'Encaixe, corte, montagem e costura.', 'Tecido aprovado', 'Peças confeccionadas'),
      step('Embalagem', 'PACKAGING', 'PACKAGING_LINE', 'Dobra, identificação e acondicionamento.', 'Peças confeccionadas', 'Produto acabado'),
      step('Centro de distribuição', 'DISTRIBUTION', 'DISTRIBUTION_CENTER', 'Separação e expedição para canais de venda.', 'Produto acabado', 'Pedidos expedidos'),
      step('Varejo', 'DISTRIBUTION', 'RETAIL_STORE', 'Exposição e comercialização.', 'Pedidos recebidos', 'Produto ao consumidor'),
      step('Tratamento de efluentes', 'OTHER', 'WASTE_TREATMENT', 'Tratamento dos efluentes dos processos úmidos.', 'Efluente industrial', 'Água tratada e lodo controlado', true),
    ],
  },
  {
    id: 'frozen-food',
    name: 'Alimentos congelados',
    sector: 'Congelados',
    summary: 'Preparação, cocção, congelamento, embalagem e cadeia fria.',
    color: '#0ea5e9',
    steps: [
      step('Recebimento refrigerado', 'RECEIVING', 'RECEIVING_DOCK', 'Conferência de matérias-primas e temperatura.', 'Matérias-primas', 'Lotes recebidos', true),
      step('Armazenamento inicial', 'STORAGE', 'COLD_STORAGE', 'Segregação refrigerada ou congelada.', 'Lotes recebidos', 'Ingredientes conservados'),
      step('Seleção e lavagem', 'PROCESSING', 'WASHING_LINE', 'Preparação higiênica dos ingredientes.', 'Ingredientes', 'Ingredientes limpos'),
      step('Corte e formulação', 'PROCESSING', 'MIXING_TANK', 'Corte, pesagem e mistura da formulação.', 'Ingredientes limpos', 'Produto formulado'),
      step('Cocção', 'PROCESSING', 'COOKING_KETTLE', 'Tratamento térmico validado.', 'Produto formulado', 'Produto cozido', true),
      step('Resfriamento rápido', 'PROCESSING', 'COOLING_TUNNEL', 'Passagem rápida pela faixa crítica de temperatura.', 'Produto cozido', 'Produto resfriado', true),
      step('Porcionamento', 'PROCESSING', 'FILLING_LINE', 'Dosagem e formação das unidades.', 'Produto resfriado', 'Porções'),
      step('Congelamento', 'STORAGE', 'COLD_STORAGE', 'Congelamento rápido e estabilização.', 'Porções', 'Produto congelado', true),
      step('Embalagem e detecção', 'PACKAGING', 'PACKAGING_LINE', 'Selagem, detecção e codificação.', 'Produto congelado', 'Produto acabado', true),
      step('Câmara de congelados', 'STORAGE', 'COLD_STORAGE', 'Estocagem sob temperatura especificada.', 'Produto acabado', 'Estoque liberado'),
      step('Distribuição congelada', 'TRANSPORT', 'TRUCK', 'Transporte sem quebra da cadeia de frio.', 'Estoque liberado', 'Produto entregue'),
    ],
  },
];
