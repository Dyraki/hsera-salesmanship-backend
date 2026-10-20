import { IBrandRepository, BrandFilter } from '../../../domain/repositories/IBrandRepository';
import { Brand } from '../../../domain/entities/Brand';

export class GetBrandsUseCase {
  constructor(private brandRepo: IBrandRepository) {}

  async execute(filter?: BrandFilter): Promise<Brand[]> {
    return await this.brandRepo.findAll(filter);
  }
}
