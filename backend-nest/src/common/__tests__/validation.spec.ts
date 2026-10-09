import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateItineraryDto } from '../../modules/itineraries/dto/create-itinerary.dto';

describe('ToId', () => {
  it('aceita id bigint enviado como string', () => {
    const dto = plainToInstance(CreateItineraryDto, { destination: '7', title: 'Lisboa' });
    expect(dto.destination).toBe(7);
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('mantem numero e recusa texto nao numerico', () => {
    expect(plainToInstance(CreateItineraryDto, { destination: 3 }).destination).toBe(3);
    const invalid = plainToInstance(CreateItineraryDto, { destination: 'abc' });
    expect(validateSync(invalid).map((error) => error.property)).toContain('destination');
  });
});
