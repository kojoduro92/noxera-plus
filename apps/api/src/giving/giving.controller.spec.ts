import { GivingController } from './giving.controller';

describe('GivingController', () => {
  let controller: GivingController;

  beforeEach(() => {
    controller = new GivingController({} as never);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
