import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { UploadResponseDto } from '../common/api-response.dto';
import { IsBoolean, IsIn, IsInt, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { Idempotent } from '../common/idempotent.decorator';
import { UploadService } from './upload.service';

export class RequestUploadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  cardDraftId!: string;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  filename!: string;

  @ApiProperty({ enum: ['image/jpeg', 'image/png', 'image/webp'] })
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  mimeType!: string;

  @ApiProperty({ minimum: 1, maximum: 10_485_760 })
  @IsInt()
  @Min(1)
  @Max(10_485_760)
  size!: number;

  @ApiProperty({ pattern: '^[0-9a-f]{64}$' })
  @Matches(/^[0-9a-f]{64}$/)
  contentSha256!: string;
}

export class CompleteUploadDto {
  @ApiProperty()
  @IsBoolean()
  attestationAccepted!: boolean;
}

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @Idempotent()
  @ApiOperation({ operationId: 'requestUpload' })
  @ApiCreatedResponse({ type: UploadResponseDto })
  async request(@Req() request: AuthenticatedRequest, @Body() dto: RequestUploadDto) {
    return this.uploadService.request(request.user.id, request.header('idempotency-key')!, dto);
  }

  @Get(':uploadId')
  @ApiOperation({ operationId: 'getUpload' })
  @ApiOkResponse({ type: UploadResponseDto })
  async get(
    @Req() request: AuthenticatedRequest,
    @Param('uploadId', new ParseUUIDPipe({ version: '4' })) uploadId: string,
  ) {
    return this.uploadService.get(request.user.id, uploadId);
  }

  @Put(':uploadId/content')
  @Idempotent()
  @ApiConsumes('application/octet-stream')
  @ApiBody({ schema: { type: 'string', format: 'binary' } })
  @ApiOperation({ operationId: 'storeMockUploadContent' })
  @ApiOkResponse({ type: UploadResponseDto })
  async storeContent(
    @Req() request: AuthenticatedRequest,
    @Param('uploadId', new ParseUUIDPipe({ version: '4' })) uploadId: string,
    @Body() content: Buffer,
  ) {
    return this.uploadService.storeContent(request.user.id, uploadId, request.header('idempotency-key')!, content);
  }

  @Patch(':uploadId/complete')
  @Idempotent()
  @ApiOperation({ operationId: 'completeMockUpload' })
  @ApiOkResponse({ type: UploadResponseDto })
  async complete(
    @Req() request: AuthenticatedRequest,
    @Param('uploadId', new ParseUUIDPipe({ version: '4' })) uploadId: string,
    @Body() dto: CompleteUploadDto,
  ) {
    return this.uploadService.complete(
      request.user.id,
      uploadId,
      request.header('idempotency-key')!,
      dto.attestationAccepted,
    );
  }
}
