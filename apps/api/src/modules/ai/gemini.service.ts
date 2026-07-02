import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private geminiClient: GoogleGenerativeAI | null = null;
  private readonly geminiModels = new Map<string, GenerativeModel>();
  private readonly geminiCandidates: string[];
  private geminiActiveModelName: string;
  private readonly groqApiKey: string | null;
  private readonly groqModelName: string;
  private readonly groqBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.groqApiKey = this.config.get<string>('GROQ_API_KEY')?.trim() || null;
    this.groqModelName = this.config.get<string>('GROQ_MODEL')?.trim() || 'llama-3.3-70b-versatile';
    this.groqBaseUrl = this.config.get<string>('GROQ_BASE_URL')?.trim() || 'https://api.groq.com/openai/v1';

    const geminiApiKey = this.config.get<string>('GEMINI_API_KEY')?.trim();
    const primaryModel = this.config.get<string>('GEMINI_MODEL')?.trim() || 'gemini-2.5-flash';
    // Cotas do Google sao por modelo (o free tier do gemini-2.0-flash foi zerado);
    // com falha no primario, tentamos os reservas antes de desistir do Gemini.
    const fallbackModels = (this.config.get<string>('GEMINI_FALLBACK_MODELS') ?? 'gemini-2.5-flash,gemini-2.5-flash-lite')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    this.geminiCandidates = [...new Set([primaryModel, ...fallbackModels])];
    this.geminiActiveModelName = primaryModel;

    if (this.groqApiKey) {
      this.logger.log(`Groq inicializado com modelo ${this.groqModelName}.`);
    }

    if (!geminiApiKey) {
      if (!this.groqApiKey) {
        this.logger.warn('GROQ_API_KEY/GEMINI_API_KEY ausentes - servico de IA respondera com fallback deterministico.');
      }
      return;
    }

    try {
      this.geminiClient = new GoogleGenerativeAI(geminiApiKey);
      this.logger.log(`Gemini inicializado com modelo ${primaryModel} (reservas: ${this.geminiCandidates.slice(1).join(', ') || 'nenhuma'}).`);
    } catch (err: any) {
      this.logger.error(`Falha ao inicializar Gemini: ${err?.message ?? err}`);
      this.geminiClient = null;
    }
  }

  get isEnabled(): boolean {
    return Boolean(this.groqApiKey) || this.geminiClient !== null;
  }

  get provider(): 'groq' | 'gemini' | 'rules' {
    if (this.geminiClient) return 'gemini';
    if (this.groqApiKey) return 'groq';
    return 'rules';
  }

  get modelName(): string | null {
    if (this.geminiClient) return this.geminiActiveModelName;
    if (this.groqApiKey) return this.groqModelName;
    return null;
  }

  private getGeminiModel(name: string): GenerativeModel | null {
    if (!this.geminiClient) return null;
    let model = this.geminiModels.get(name);
    if (!model) {
      model = this.geminiClient.getGenerativeModel({ model: name });
      this.geminiModels.set(name, model);
    }
    return model;
  }

  /**
   * Gera texto livre a partir de prompt + contexto. Retorna null em caso de
   * indisponibilidade para o chamador decidir fallback.
   */
  async generateText(prompt: string, options?: { temperature?: number; maxOutputTokens?: number }): Promise<string | null> {
    if (!this.isEnabled) return null;
    if (this.geminiClient) {
      const geminiText = await this.generateGeminiText(prompt, options);
      if (geminiText || !this.groqApiKey) return geminiText;
    }
    if (this.groqApiKey) {
      return this.generateGroqText(prompt, options);
    }
    return null;
  }

  private async generateGroqText(prompt: string, options?: { temperature?: number; maxOutputTokens?: number }): Promise<string | null> {
    if (!this.groqApiKey) return null;
    try {
      const response = await fetch(`${this.groqBaseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.groqModelName,
          messages: [{ role: 'user', content: prompt }],
          temperature: options?.temperature ?? 0.5,
          max_tokens: options?.maxOutputTokens ?? 1024,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        this.logger.error(`Falha Groq generateText: HTTP ${response.status}. ${errorText.slice(0, 300)}`);
        return null;
      }

      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return payload.choices?.[0]?.message?.content?.trim() || null;
    } catch (err: any) {
      this.logger.error(`Falha Groq generateText: ${err?.message ?? err}`);
      return null;
    }
  }

  private async generateGeminiText(prompt: string, options?: { temperature?: number; maxOutputTokens?: number }): Promise<string | null> {
    if (!this.geminiClient) return null;
    // Comeca pelo ultimo modelo que funcionou para nao pagar uma chamada falha por request.
    const candidates = [...new Set([this.geminiActiveModelName, ...this.geminiCandidates])];
    for (const name of candidates) {
      const model = this.getGeminiModel(name);
      if (!model) return null;
      try {
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: options?.temperature ?? 0.5,
            maxOutputTokens: options?.maxOutputTokens ?? 1024,
          },
        });
        const text = result.response.text();
        if (name !== this.geminiActiveModelName) {
          this.logger.warn(`Gemini alternou para o modelo reserva ${name}.`);
          this.geminiActiveModelName = name;
        }
        return text;
      } catch (err: any) {
        this.logger.error(`Falha Gemini generateText (${name}): ${err?.message ?? err}`);
      }
    }
    return null;
  }

  /**
   * Tenta extrair JSON estruturado de uma resposta do modelo.
   * Devolve null se a resposta nao puder ser parseada como JSON.
   */
  async generateJson<T = unknown>(prompt: string, options?: { temperature?: number; maxOutputTokens?: number }): Promise<T | null> {
    if (!this.isEnabled) return null;
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
