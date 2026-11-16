import { BadRequestException } from '@nestjs/common';
// bpmn-moddle 9 expõe CommonJS, compatível com o build NestJS existente.
const BpmnModdle = require('bpmn-moddle');

export const EMPTY_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_1" targetNamespace="https://gestao360.org/processes">
  <bpmn:process id="Process_1" isExecutable="false"><bpmn:startEvent id="StartEvent_1" name="Início" /></bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_1"><bpmndi:BPMNPlane id="Plane_1" bpmnElement="Process_1"><bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1"><dc:Bounds x="170" y="120" width="36" height="36" /></bpmndi:BPMNShape></bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;

export async function readBpmn(xml: string) {
  if (!xml || Buffer.byteLength(xml, 'utf8') > 2_000_000) throw new BadRequestException('O BPMN deve ter até 2 MB.');
  if (/<!DOCTYPE|<!ENTITY|<\s*(?:\w+:)?import\b/i.test(xml)) throw new BadRequestException('Declarações externas não são permitidas no BPMN.');
  let parsed: any;
  try { parsed = await new BpmnModdle().fromXML(xml); } catch { throw new BadRequestException('XML BPMN inválido.'); }
  const { rootElement, warnings, elementsById } = parsed;
  if (rootElement.$type !== 'bpmn:Definitions' || !rootElement.diagrams?.length) throw new BadRequestException('Inclua um diagrama BPMN 2.0 com informações visuais.');
  if (warnings?.length) throw new BadRequestException(`BPMN contém referências ou elementos inválidos: ${String(warnings[0].message).slice(0, 200)}`);
  const all: any[] = Object.values(elementsById);
  if (all.length > 5000) throw new BadRequestException('O diagrama excede 5.000 elementos.');
  const elements = all.filter((element) => element.$instanceOf?.('bpmn:FlowNode'));
  const activities = elements.filter((element) => element.$instanceOf?.('bpmn:Activity')).map((element) => ({
    elementId: element.id as string, elementType: element.$type as string,
    name: String(element.name || element.id).slice(0, 240),
    description: (element.documentation ?? []).map((doc: any) => String(doc.text ?? '')).join('\n').slice(0, 4000) || null,
  }));
  const issues: string[] = [];
  const processes = all.filter((element) => element.$type === 'bpmn:Process');
  if (!processes.length) issues.push('Inclua ao menos um processo.');
  for (const process of processes) {
    const nodes = (process.flowElements ?? []).filter((element: any) => element.$instanceOf?.('bpmn:FlowNode'));
    if (!nodes.some((element: any) => element.$type === 'bpmn:StartEvent')) issues.push(`${process.name || process.id}: falta evento de início.`);
    if (!nodes.some((element: any) => element.$type === 'bpmn:EndEvent')) issues.push(`${process.name || process.id}: falta evento de fim.`);
  }
  for (const element of elements) {
    if (element.$type !== 'bpmn:StartEvent' && element.$type !== 'bpmn:BoundaryEvent' && !element.incoming?.length) issues.push(`${element.name || element.id}: sem fluxo de entrada.`);
    if (element.$type !== 'bpmn:EndEvent' && !element.outgoing?.length) issues.push(`${element.name || element.id}: sem fluxo de saída.`);
  }
  return { activities, issues };
}
