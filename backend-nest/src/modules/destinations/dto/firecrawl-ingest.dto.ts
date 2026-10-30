import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsInt, IsUrl } from 'class-validator';
import { ToId } from '../../../common/validation';

export class FirecrawlIngestDto {
  @ToId()
  @IsInt()
  destination_id!: number;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(10)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { each: true })
  source_urls!: string[];
}
