import mongoose from 'mongoose';
import { Category, ICategory } from '../models/category.model';
import { NotFoundError, BadRequestError } from '@ecoalert/shared';

// Dịch vụ danh mục để quản lý các danh mục sự cố môi trường, bao gồm tạo, cập nhật, xóa và truy vấn danh mục.
export class CategoryService {
  async getCategories(includeInactive = false): Promise<ICategory[]> {
    const filter = includeInactive ? {} : { isActive: true };
    return Category.find(filter).sort({ name: 1 });
  }

  async getCategoryById(id: string): Promise<ICategory> {
    if (!mongoose.isValidObjectId(id)) throw new BadRequestError('Invalid category ID');
    const category = await Category.findById(id);
    if (!category) throw new NotFoundError('Category not found');
    return category;
  }

  async createCategory(data: Partial<ICategory>): Promise<ICategory> {
    const codeSource = data.code || (data.name || '').toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const normalizedCode = codeSource.toUpperCase();
    const existing = await Category.findOne({ code: normalizedCode });
    if (existing) throw new BadRequestError('Category code already exists');

    const category = new Category({
      name: data.name,
      code: normalizedCode,
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.icon !== undefined ? { icon: data.icon } : {}),
      ...(data.defaultSeverity !== undefined ? { defaultSeverity: data.defaultSeverity } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    });
    return category.save();
  }

  async updateCategory(id: string, data: Partial<ICategory>): Promise<ICategory> {
    if (!mongoose.isValidObjectId(id)) throw new BadRequestError('Invalid category ID');
    const updateData: Partial<ICategory> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.defaultSeverity !== undefined) updateData.defaultSeverity = data.defaultSeverity;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.code) {
      updateData.code = data.code.toUpperCase();
      const existing = await Category.findOne({ code: updateData.code, _id: { $ne: id } });
      if (existing) throw new BadRequestError('Category code already exists');
    }

    const category = await Category.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    );
    if (!category) throw new NotFoundError('Category not found');
    return category;
  }

  async deleteCategory(id: string, userId: string): Promise<void> {
    if (!mongoose.isValidObjectId(id)) throw new BadRequestError('Invalid category ID');
    const category = await Category.findById(id);
    if (!category) throw new NotFoundError('Category not found');
    await category.softDelete(userId);
  }
}

export const categoryService = new CategoryService();
