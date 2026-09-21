import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ItinerariesService } from './itineraries.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';

@Controller('api/reviews')
export class ReviewsController {
  constructor(private readonly itineraries: ItinerariesService, private readonly response: ApiResponseBuilder) {}

  @Get()
  async list(@Query('itinerary') itinerary?: string) {
    return this.response.withMessage('Lista carregada com sucesso.').build(await this.itineraries.listReviews(itinerary ? Number(itinerary) : undefined));
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReviewDto) {
    return this.response.withMessage('Registro criado com sucesso.').build(await this.itineraries.createReview(user.id, dto));
  }
}
