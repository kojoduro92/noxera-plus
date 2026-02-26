import { EventsService } from './events.service';

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(() => {
    service = new EventsService({} as never);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
