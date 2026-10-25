import { Body, Controller, Post } from '@nestjs/common';
import { IsBoolean, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { UploadService } from './upload.service';

export class UploadDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  cardDraftId: string;

  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsNotEmpty()
  contentType: string;

  @IsInt()
  @Min(1)
  fileSizeBytes: number;
}

export class MockUploadDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  cardDraftId: string;

  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @IsInt()
  @Min(1)
  size: number;
}

export class CommitDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  cardDraftId: string;

  @IsString()
  @IsNotEmpty()
  s3Key: string;

  @IsBoolean()
  attestationAccepted: boolean;
}

@Controller('uploads')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('request')
  async uploadReq(@Body() dto: UploadDto) {
    return this.uploadService.requestUpload(
      dto.userId,
      dto.cardDraftId,
      dto.filename,
      dto.contentType,
      dto.fileSizeBytes,
    );
  }

  @Post('commit')
  async commitReq(@Body() dto: CommitDto) {
    return this.uploadService.commitUpload(
      dto.userId,
      dto.cardDraftId,
      dto.s3Key,
      dto.attestationAccepted,
    );
  }

  @Post('mock')
  async mockUpload(@Body() dto: MockUploadDto) {
    return this.uploadService.createMockUpload(dto);
  }
}
