import { MessagesController } from './messages.controller';

describe('MessagesController', () => {
  let controller: MessagesController;

  beforeEach(() => {
    controller = new MessagesController({} as never);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
