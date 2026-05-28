import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';

@Module({
  controllers: [AiController],
  providers: [GeminiService, AiService],
  exports: [GeminiService, AiService],
})
export class AiModule {}
