/**
 * Gera PDF dos fluxogramas de proposta de menu.
 * Uso: node scripts/export-menu-proposta-pdf.mjs
 */
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(root, 'docs', 'arquitetura-menu-proposta.html');
const pdfPath = path.join(root, 'docs', 'arquitetura-menu-proposta.pdf');
const htmlUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(htmlUrl, { waitUntil: 'networkidle' });
// Aguarda Mermaid renderizar os diagramas
await page.waitForFunction(() => document.querySelectorAll('.mermaid svg').length >= 6, { timeout: 30000 });
await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
});
await browser.close();
console.log(`PDF gerado: ${pdfPath}`);
