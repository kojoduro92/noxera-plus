import { EventsController } from './events.controller';

describe('EventsController', () => {
  let controller: EventsController;

  beforeEach(() => {
    controller = new EventsController({} as never);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
