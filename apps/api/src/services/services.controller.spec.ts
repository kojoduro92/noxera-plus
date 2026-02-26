import { ServicesController } from './services.controller';

describe('ServicesController', () => {
  let controller: ServicesController;

  beforeEach(() => {
    controller = new ServicesController({} as never);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
