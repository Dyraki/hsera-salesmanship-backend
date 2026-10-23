import { Channel } from '../entities/Channel';

export interface ChannelFilter {
  status?: string;
}

export interface IChannelRepository {
  findAll(filter?: ChannelFilter): Promise<Channel[]>;
  findById(id: string): Promise<Channel | null>;
  findByKode(kode: string): Promise<Channel | null>;
}
