import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LlmJob, LlmJobLog, LlmModel, PromptTemplate } from './entities';
import { Itinerary, ItineraryDailyEvent, ItineraryDay } from '../itineraries/entities';
import { TravelerDnaProfile, UserTripPreference } from '../profiles/entities';
import { PointOfInterest } from '../destinations/entities';
import { ItineraryGeneratorFactory } from '../../common/factories/itinerary-generator.factory';

@Injectable()
export class AiService {
  constructor(
    @InjectRepository(LlmJob) private readonly jobs: Repository<LlmJob>,
    @InjectRepository(LlmJobLog) private readonly logs: Repository<LlmJobLog>,
    @InjectRepository(LlmModel) private readonly models: Repository<LlmModel>,
    @InjectRepository(PromptTemplate) private readonly templates: Repository<PromptTemplate>,
    @InjectRepository(Itinerary) private readonly itineraries: Repository<Itinerary>,
    @InjectRepository(TravelerDnaProfile) private readonly profiles: Repository<TravelerDnaProfile>,
    @InjectRepository(UserTripPreference) private readonly preferences: Repository<UserTripPreference>,
    @InjectRepository(PointOfInterest) private readonly pois: Repository<PointOfInterest>,
    private readonly generatorFactory: ItineraryGeneratorFactory,
  ) {}

  listModels(): Promise<LlmModel[]> {
    return this.models.find({ where: { is_active: true }, relations: { provider: true } });
  }

  listJobs(userId: number): Promise<LlmJob[]> {
    return this.jobs.find({
      where: { user: { id: userId } },
      relations: { destination: true, itinerary: true, llm_model: true, logs: true },
      order: { created_at: 'DESC' },
    });
  }

  async createJob(itinerary: Itinerary, userId: number): Promise<LlmJob> {
    const model = await this.models.findOne({ where: { is_default: true, is_active: true }, relations: { provider: true } });
    const template = await this.templates.findOne({ where: { key: 'itinerary-generation', is_active: true } });
    const job = await this.jobs.save(
      this.jobs.create({
        user: { id: userId } as never,
        itinerary,
        destination: itinerary.destination,
        llm_model: model,
        prompt_template: template,
        request_payload: { itinerary_id: itinerary.id, destination_id: itinerary.destination.id },
        status: 'queued',
      }),
    );
    await this.logs.save(this.logs.create({ llm_job: job, message: 'Job queued.', payload: {} }));
    return job;
  }

  async runJob(jobId: number): Promise<LlmJob> {
    const job = await this.jobs.findOne({
      where: { id: jobId },
      relations: { itinerary: { destination: true }, destination: true, prompt_template: true, llm_model: true, user: true },
    });
    if (!job) throw new NotFoundException('Job de geracao nao encontrado.');
    if (!job.itinerary) {
      job.status = 'failed';
      job.error_message = 'Missing itinerary.';
      return this.jobs.save(job);
    }

    job.status = 'running';
    await this.jobs.save(job);
    await this.logs.save(this.logs.create({ llm_job: job, message: 'Job started.', payload: {} }));

    const itinerary = job.itinerary;
    const profile = await this.profiles.findOne({ where: { user: { id: job.user.id } } });
    const preferences = await this.preferences.findOne({ where: { user: { id: job.user.id } } });
    const pois = await this.pois.find({ where: { destination: { id: itinerary.destination.id } }, order: { rating: 'DESC', name: 'ASC' } });
    const result = this.generatorFactory.create().generate({
      itinerary,
      profile,
      preferences,
      pois,
      promptTemplate: job.prompt_template,
    });

    // Tudo ou nada: falha no meio nao deixa o roteiro sem dias.
    await this.jobs.manager.transaction(async (manager) => {
      itinerary.title = result.title;
      itinerary.summary = result.summary;
      itinerary.budget_total = result.estimated_cost;
      itinerary.currency_code = result.currency_code;
      itinerary.generation_status = 'ready';
      itinerary.generation_context = {
        profile_id: profile?.id ?? null,
        preferences_id: preferences?.id ?? null,
        ...result.metadata,
      };
      await manager.save(itinerary);

      // As FKs do Django sao NO ACTION: eventos saem antes dos dias.
      const previousDays = await manager.find(ItineraryDay, { select: { id: true }, where: { itinerary: { id: itinerary.id } } });
      const dayIds = previousDays.map((day) => day.id);
      if (dayIds.length > 0) {
        const previousEvents = await manager.find(ItineraryDailyEvent, { select: { id: true }, where: { itinerary_day: { id: In(dayIds) } } });
        if (previousEvents.length > 0) await manager.delete(ItineraryDailyEvent, previousEvents.map((event) => event.id));
        await manager.delete(ItineraryDay, dayIds);
      }

      for (let dayIndex = 0; dayIndex < result.days.length; dayIndex += 1) {
        const dayData = result.days[dayIndex];
        const savedDay = await manager.save(
          manager.create(ItineraryDay, {
            itinerary,
            day_number: dayIndex + 1,
            title: dayData.title,
            summary: dayData.summary,
            estimated_cost: dayData.events.reduce((total, event) => total + Number(event.estimated_cost), 0).toFixed(2),
          }),
        );
        for (const event of dayData.events) {
          await manager.save(
            manager.create(ItineraryDailyEvent, {
              itinerary_day: savedDay,
              title: event.title,
              description: event.description,
              estimated_cost: event.estimated_cost,
              order_index: event.order_index,
              poi: event.poi_id ? ({ id: event.poi_id } as PointOfInterest) : null,
            }),
          );
        }
      }
    });

    job.status = 'completed';
    job.response_payload = result as unknown as Record<string, unknown>;
    const savedJob = await this.jobs.save(job);
    await this.logs.save(this.logs.create({ llm_job: job, message: 'Job completed.', payload: result.metadata }));
    return savedJob;
  }

  async markJobFailed(jobId: number, itineraryId: number, reason: string): Promise<void> {
    await this.jobs.update({ id: jobId }, { status: 'failed', error_message: reason });
    await this.itineraries.update({ id: itineraryId }, { generation_status: 'failed' });
    await this.logs.save(this.logs.create({ llm_job: { id: jobId } as LlmJob, level: 'error', message: 'Job failed.', payload: { error: reason } }));
  }
}
