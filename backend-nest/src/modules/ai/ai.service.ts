import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    @InjectRepository(ItineraryDay) private readonly days: Repository<ItineraryDay>,
    @InjectRepository(ItineraryDailyEvent) private readonly events: Repository<ItineraryDailyEvent>,
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
    if (!job) throw new NotFoundException('LLM job not found.');
    if (!job.itinerary) {
      job.status = 'failed';
      job.error_message = 'Missing itinerary.';
      return this.jobs.save(job);
    }

    job.status = 'running';
    await this.jobs.save(job);
    await this.logs.save(this.logs.create({ llm_job: job, message: 'Job started.', payload: {} }));

    const profile = await this.profiles.findOne({ where: { user: { id: job.user.id } } });
    const preferences = await this.preferences.findOne({ where: { user: { id: job.user.id } } });
    const pois = await this.pois.find({ where: { destination: { id: job.itinerary.destination.id } }, order: { rating: 'DESC', name: 'ASC' } });
    const result = this.generatorFactory.create().generate({
      itinerary: job.itinerary,
      profile,
      preferences,
      pois,
      promptTemplate: job.prompt_template,
    });

    job.itinerary.title = result.title;
    job.itinerary.summary = result.summary;
    job.itinerary.budget_total = result.estimated_cost;
    job.itinerary.currency_code = result.currency_code;
    job.itinerary.generation_status = 'ready';
    job.itinerary.generation_context = {
      profile_id: profile?.id ?? null,
      preferences_id: preferences?.id ?? null,
      ...result.metadata,
    };
    await this.itineraries.save(job.itinerary);
    await this.days.delete({ itinerary: { id: job.itinerary.id } });

    for (let dayIndex = 0; dayIndex < result.days.length; dayIndex += 1) {
      const dayData = result.days[dayIndex];
      const savedDay = await this.days.save(
        this.days.create({
          itinerary: job.itinerary,
          day_number: dayIndex + 1,
          title: dayData.title,
          summary: dayData.summary,
          estimated_cost: dayData.events.reduce((total, event) => total + Number(event.estimated_cost), 0).toFixed(2),
        }),
      );
      for (const event of dayData.events) {
        await this.events.save(
          this.events.create({
            itinerary_day: savedDay,
            title: event.title,
            description: event.description,
            estimated_cost: event.estimated_cost,
            order_index: event.order_index,
            poi: event.poi_id ? ({ id: event.poi_id } as never) : null,
          }),
        );
      }
    }

    job.status = 'completed';
    job.response_payload = result as unknown as Record<string, unknown>;
    const savedJob = await this.jobs.save(job);
    await this.logs.save(this.logs.create({ llm_job: job, message: 'Job completed.', payload: result.metadata }));
    return savedJob;
  }
}
