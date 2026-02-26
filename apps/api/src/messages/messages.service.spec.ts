import { MessagesService } from './messages.service';

describe('MessagesService', () => {
  let service: MessagesService;

  beforeEach(() => {
    service = new MessagesService({} as never);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
