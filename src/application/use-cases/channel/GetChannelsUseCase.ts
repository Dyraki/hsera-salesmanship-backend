import { IChannelRepository } from '../../../domain/repositories/IChannelRepository';
import { Channel } from '../../../domain/entities/Channel';

export class GetChannelsUseCase {
  constructor(private channelRepo: IChannelRepository) {}

  async execute(status?: string): Promise<Channel[]> {
    return await this.channelRepo.findAll({ status });
  }
}
