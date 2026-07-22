import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

// Global make the database module available to the entire app
@Global()
@Module({
  // export to other modules that want to use it
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
