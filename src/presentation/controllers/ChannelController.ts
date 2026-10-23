import { Request, Response, NextFunction } from 'express';
import { PrismaChannelRepository } from '../../infrastructure/database/repositories/PrismaChannelRepository';
import { GetChannelsUseCase } from '../../application/use-cases/channel/GetChannelsUseCase';

const channelRepo = new PrismaChannelRepository();
const getChannelsUC = new GetChannelsUseCase(channelRepo);

export class ChannelController {
  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.query;
      const channels = await getChannelsUC.execute(status ? String(status) : 'AKTIF');
      res.json({
        success: true,
        data: channels.map((c) => ({
          id: c.id,
          kode: c.kode,
          nama: c.nama,
          deskripsi: c.deskripsi,
          urutan: c.urutan,
          status: c.status,
        })),
      });
    } catch (err) {
      next(err);
    }
  }
}
