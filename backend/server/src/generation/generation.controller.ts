import {Controller, Get, Post, Param} from '@nestjs/common';
import {GenerationService} from './generation.service';

@Controller('generation')
export class GenerationController {
    constructor(private readonly generationService: GenerationService) {
        
    }

}