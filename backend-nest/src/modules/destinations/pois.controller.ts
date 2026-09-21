import { Controller, Get, Query } from '@nestjs/common';
import { DestinationsService } from './destinations.service';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';

@Controller('api/pois')
export class PoisController {
  constructor(private readonly destinations: DestinationsService, private readonly response: ApiResponseBuilder) {}

  @Get()
  async list(@Query('destination') destination?: string, @Query('poi_type') poiType?: string) {
    return this.response
      .withMessage('Lista carregada com sucesso.')
      .build(await this.destinations.listPois({ destination: destination ? Number(destination) : undefined, poi_type: poiType }));
  }
}
