import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private model: GenerativeModel | null = null;
  private readonly modelName: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    this.modelName = this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash';
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY ausente - servico de IA respondera com fallback deterministico.');
      return;
    }
    try {
      const client = new GoogleGenerativeAI(apiKey);
      this.model = client.getGenerativeModel({ model: this.modelName });
      this.logger.log(`GeminiService inicializado com modelo ${this.modelName}.`);
    } catch (err: any) {
      this.logger.error(`Falha ao inicializar Gemini: ${err?.message ?? err}`);
      this.model = null;
    }
  }

  get isEnabled(): boolean {
    return this.model !== null;
  }

  /**
   * Gera texto livre a partir de prompt + contexto. Retorna null em caso de
   * indisponibilidade para o chamador decidir fallback.
   */
  async generateText(prompt: string, options?: { temperature?: number; maxOutputTokens?: number }): Promise<string | null> {
    if (!this.model) return null;
    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options?.temperature ?? 0.5,
          maxOutputTokens: options?.maxOutputTokens ?? 1024,
        },
      });
      return result.response.text();
    } catch (err: any) {
      this.logger.error(`Falha Gemini generateText: ${err?.message ?? err}`);
      return null;
    }
  }

  /**
   * Tenta extrair JSON estruturado de uma resposta do modelo.
   * Devolve null se a resposta nao puder ser parseada como JSON.
   */
  async generateJson<T = unknown>(prompt: string, options?: { temperature?: number; maxOutputTokens?: number }): Promise<T | null> {
    if (!this.model) return null;
    const fullPrompt = `${prompt}\n\nResponda APENAS com JSON valido (sem markdown, sem comentarios, sem texto extra).`;
    const text = await this.generateText(fullPrompt, options);
    if (!text) return null;
    const cleaned = text
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```\s*$/, '')
      .trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch (err: any) {
      this.logger.warn(`Resposta Gemini nao e JSON valido: ${err?.message ?? err}. Trecho: ${cleaned.slice(0, 200)}`);
      return null;
    }
  }
}
