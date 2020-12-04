import { Injectable } from '@nestjs/common';
import { CategoryDto, SubCategoryDto } from '../dto/category.dto';
import { Category } from '../entities/category.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubCategory } from '../entities/sub-category.entity';
import { ThrowErrors } from '../../../commons/functions/throw-errors';
import NotFound = ThrowErrors.NotFound;
import { SubCategoryService } from './sub-category.service';


@Injectable()
export class CategoryService {

  constructor(@InjectRepository(Category) private readonly categoryRepository: Repository<Category>,
              private subCategoryService: SubCategoryService) {
  }

  async getAllCategories(): Promise<Category[]> {
    return await this.categoryRepository.find();
  }

  async searchByName(name: string, take: number) {
    const queryBuilder = this.categoryRepository.createQueryBuilder('category');
    const categories = await queryBuilder.leftJoinAndSelect('category.subCategories', 'subCategory')
      .leftJoinAndSelect('subCategory.products', 'product')
      .where('category.name ILIKE :name', { name: `%${name}%` })
      .take(take)
      .getMany();
    return categories;
  }
  async getMatchingByNames(name: string) {
    const queryBuilder = this.categoryRepository.createQueryBuilder('category');
    const searchResults
      = await queryBuilder.select('category.name')
      .where('category.name ILIKE :name', { name: `%${name}%` })
      .getMany();
    return searchResults;
  }

  async getTotalCategories() {
    return await this.categoryRepository.createQueryBuilder().getCount();
  }

  async getCategoryById(id: number): Promise<Category> {
    console.log(id)
    const category = await this.categoryRepository.findOne({
      where: {
        id,
      },
    });
    if (!category) {
      NotFound('Category', id);
    }
    return category;
  }

  async updateCategory(id: number, updateCategoryDto: CategoryDto): Promise<Category> {
    const category = await this.getCategoryById(id);
    const { name, description } = updateCategoryDto;
    if (name) {
      category.name = name;
    }

    if (description) {
      category.description = description;
    }
    category.updatedAt = new Date();
    const updatedCategory = await category.save();
    return updatedCategory;
  }


  async newCategory(createCategoryDto: CategoryDto): Promise<Category> {
    const { name, description } = createCategoryDto;
    const category = new Category();
    category.name = name;
    category.description = description;
    category.subCategories = [];
    const newCategory = await category.save();
    return newCategory;
  }


  async addSubCategory(id: number, subCategoryDto: SubCategoryDto): Promise<SubCategory> {
    const category = await this.getCategoryById(id);
    const { name, description, references } = subCategoryDto;
    const subCategory = new SubCategory();
    subCategory.category = category;
    subCategory.subCategoryTags = [];
    subCategory.references = references ? references : [];
    subCategory.name = name;
    subCategory.description = description;
    subCategory.products = [];
    const newSubCategory = await subCategory.save();
    return newSubCategory;
  }


  async deleteCategory(id: number): Promise<void> {
    const category = await this.getCategoryById(id);
    for (let i = 0; i < category.subCategories.length; i++) {
      await this.subCategoryService.deleteSubCategory(category.subCategories[i].id);
    }
    const result = await this.categoryRepository.delete(id);
    if (result.affected === 0) {
      NotFound('Category', id);
    }
  }

  async getCategoriesNames(name) {
    const queryBuilder = this.categoryRepository.createQueryBuilder('category');
    const categories = await queryBuilder.select(['category.name'])
      .where('category.name ILIKE :name', { name: `%${name}%` }).getMany();
    return categories;
  }
}
