import { WebsiteController } from './website.controller';

describe('WebsiteController', () => {
  let controller: WebsiteController;

  beforeEach(() => {
    controller = new WebsiteController({} as never);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
