import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateReportDto } from './create-report.dto';

export class SyncReportsDto {
  @ApiProperty({ type: [CreateReportDto], description: 'List of reports created offline to sync to the server' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReportDto)
  reports: CreateReportDto[];
}
