import {Injectable} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class GenerationService {
    constructor(private readonly databaseService: DatabaseService) {}

    // async generateImage(prompt: string): Promise<string> {
        
    // }
}