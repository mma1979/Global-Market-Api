import { EntityRepository, Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { GetProductsByRangeDto } from '../dto/get-products-by-range.dto';

@EntityRepository(Product)
export class ProductRepository extends Repository<Product> {

  async getShopProducts(take: number) {
    const queryBuilder = this.getQueryBuilder();
    const products = await queryBuilder.leftJoinAndSelect('product.productTags', 'productTag')
      .take(take).getMany();
    return products;
  }

  async getProductsByTagName(tag: string) {
    const queryBuilder = this.getQueryBuilder();
    const products = await queryBuilder.leftJoinAndSelect('product.productTags', 'productTag')
      .where('productTag.productId IS NOT NULL AND productTag.name LIKE :name', { name: tag }).getMany();
    return products;
  }

  async getCurrentMonthProducts() {
    const queryBuilder = this.getQueryBuilder();
    const currentMonth = new Date().getMonth();
    const products = await queryBuilder.leftJoinAndSelect('product.productTags', 'productTag').take(16).getMany();
    const filteredProducts = [].concat(products.filter(p => (p.createdAt.getMonth() + 1) === currentMonth));
    return filteredProducts;
  }

  async getLatestProducts() {
    const queryBuilder = this.getQueryBuilder();
    const products = await queryBuilder.leftJoinAndSelect('product.productTags', 'productTag')
      .take(10).orderBy('product.createdAt').getMany();
    return products;
  }

  async getMostSalesProducts() {
    const queryBuilder = this.getQueryBuilder();
    const products = await queryBuilder.orderBy({
      'product.sales': 'DESC',
    }).leftJoinAndSelect('product.productTags', 'productTag')
      .take(10).getMany();
    return products;
  }

  getQueryBuilder() {
    return this.createQueryBuilder('product');
  }

  async filterByRangePrice(getProductsByRangeDto: GetProductsByRangeDto) {
    const { range1, range2, skip, take } = getProductsByRangeDto;
    const queryBuilder = this.getQueryBuilder();
    queryBuilder.leftJoinAndSelect('product.productTags', 'productTag')
      .where('product.currentPrice >= :range1', { range1: range1 })
      .andWhere('product.currentPrice <= :range2', { range2: range2 });
    if (take) {
      queryBuilder.take(take);
    }
    if (skip) {
      queryBuilder.skip(skip);
    }
    const products = await queryBuilder.getMany();
    return products;
  }

  async getTotalProducts() {
    return await this.createQueryBuilder().getCount();
  }

  async getTotalSales(): Promise<number> {
    const { sum } = await this
      .createQueryBuilder('product')
      .select('SUM(product.sales)', 'sum').getRawOne();
    return sum ? sum : 0;
  }

  async filterByExistenceInStock(limit: number, inStock?: boolean, outOfStock?: boolean) {
    const queryBuilder = this.getQueryBuilder();
    queryBuilder.leftJoinAndSelect('product.productTags', 'productTag');
    if (inStock) {
      queryBuilder.where('product.inStock = :stock', { stock: inStock });
    } else {
      queryBuilder.where('product.inStock != :stock', { stock: outOfStock });
    }
    const products = await queryBuilder.limit(limit).getMany();
    return products;
  }
}
