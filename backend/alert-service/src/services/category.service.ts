import { Category, ICategory } from '../models/category.model';
import { NotFoundError, BadRequestError } from '@ecoalert/shared';

export class CategoryService {
  async getCategories(includeInactive = false): Promise<ICategory[]> {
    const filter = includeInactive ? {} : { isActive: true };
    return Category.find(filter).sort({ name: 1 });
  }

  async getCategoryById(id: string): Promise<ICategory> {
    const category = await Category.findById(id);
    if (!category) throw new NotFoundError('Category not found');
    return category;
  }

  async createCategory(data: Partial<ICategory>): Promise<ICategory> {
    if (!data.code) {
      data.code = (data.name || '').toUpperCase().replace(/[^A-Z0-9]/g, '_');
    }
    const existing = await Category.findOne({ code: data.code.toUpperCase() });
    if (existing) throw new BadRequestError('Category code already exists');

    const category = new Category({
      ...data,
      code: data.code.toUpperCase(),
    });
    return category.save();
  }

  async updateCategory(id: string, data: Partial<ICategory>): Promise<ICategory> {
    if (data.code) {
      data.code = data.code.toUpperCase();
      const existing = await Category.findOne({ code: data.code, _id: { $ne: id } });
      if (existing) throw new BadRequestError('Category code already exists');
    }

    const category = await Category.findByIdAndUpdate(id, { $set: data }, { new: true });
    if (!category) throw new NotFoundError('Category not found');
    return category;
  }

  async deleteCategory(id: string, userId: string): Promise<void> {
    const category = await Category.findById(id);
    if (!category) throw new NotFoundError('Category not found');
    await category.softDelete(userId);
  }
}

export const categoryService = new CategoryService();
