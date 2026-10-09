import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ApiResponseBuilder } from '../../common/builders/api-response.builder';

@Controller('api/reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService, private readonly response: ApiResponseBuilder) {}

  @Get()
  async list(@Query('itinerary', new ParseIntPipe({ optional: true })) itinerary?: number) {
    const reviews = await this.reviews.list(itinerary);
    return this.response.withMessage('Lista carregada com sucesso.').build(reviews);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReviewDto) {
    const review = await this.reviews.create(user.id, dto);
    return this.response.withMessage('Avaliacao publicada com sucesso.').build(review);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateReviewDto) {
    const review = await this.reviews.update(user.id, id, dto);
    return this.response.withMessage('Avaliacao atualizada com sucesso.').build(review);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    await this.reviews.remove(user.id, id);
    return this.response.withMessage('Avaliacao removida com sucesso.').build(null);
  }
}
