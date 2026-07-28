import { Body, Controller, Post, Req } from '@nestjs/common';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { UploadService } from './upload.service';
import type { AuthenticatedRequest } from '../auth/auth.types';

export class UploadDto {
  @IsString()
  @IsNotEmpty()
  cardDraftId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filename: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  contentType: string;

  @IsInt()
  @Min(1)
  fileSizeBytes: number;
}

export class MockUploadDto {
  @IsString()
  @IsNotEmpty()
  cardDraftId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filename: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  mimeType: string;

  @IsInt()
  @Min(1)
  size: number;
}

export class CommitDto {
  @IsString()
  @IsNotEmpty()
  cardDraftId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  s3Key: string;

  @IsBoolean()
  attestationAccepted: boolean;
}

@Controller('uploads')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('request')
  async uploadReq(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UploadDto,
  ) {
    return this.uploadService.requestUpload(
      request.localUser.id,
      dto.cardDraftId,
      dto.filename,
      dto.contentType,
      dto.fileSizeBytes,
    );
  }

  @Post('commit')
  async commitReq(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CommitDto,
  ) {
    return this.uploadService.commitUpload(
      request.localUser.id,
      dto.cardDraftId,
      dto.s3Key,
      dto.attestationAccepted,
    );
  }

  @Post('mock')
  async mockUpload(
    @Req() request: AuthenticatedRequest,
    @Body() dto: MockUploadDto,
  ) {
    return this.uploadService.createMockUpload(request.localUser.id, dto);
  }
}
