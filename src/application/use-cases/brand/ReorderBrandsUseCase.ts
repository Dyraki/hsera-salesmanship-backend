import { IBrandRepository } from '../../../domain/repositories/IBrandRepository';
import { AppError } from '../../../domain/errors/AppError';

export class ReorderBrandsUseCase {
  constructor(private brandRepo: IBrandRepository) {}

  async execute(orders: { id: string; urutan: number }[]): Promise<void> {
    if (!Array.isArray(orders) || orders.length === 0) {
      throw AppError.badRequest('List urutan brand tidak valid.');
    }
    await this.brandRepo.updateOrder(orders);
  }
}
