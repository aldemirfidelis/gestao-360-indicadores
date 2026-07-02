import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

@Module({
  controllers: [AiController, AssistantController],
  providers: [GeminiService, AiService, AssistantService],
  exports: [GeminiService, AiService, AssistantService],
})
export class AiModule {}
