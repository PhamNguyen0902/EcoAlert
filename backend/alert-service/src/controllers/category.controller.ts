import { Request, Response } from 'express';
import { categoryService } from '../services/category.service';
import { successResponse } from '@ecoalert/shared';

export class CategoryController {
  async getCategories(req: Request, res: Response) {
    const includeInactive = req.query.includeInactive === 'true';
    const categories = await categoryService.getCategories(includeInactive);
    res.status(200).json(successResponse(categories));
  }

  async getCategoryById(req: Request, res: Response) {
    const category = await categoryService.getCategoryById(req.params.id);
    res.status(200).json(successResponse(category));
  }

  async createCategory(req: Request, res: Response) {
    const category = await categoryService.createCategory(req.body);
    res.status(201).json(successResponse(category, 'Category created successfully'));
  }

  async updateCategory(req: Request, res: Response) {
    const category = await categoryService.updateCategory(req.params.id, req.body);
    res.status(200).json(successResponse(category, 'Category updated successfully'));
  }

  async deleteCategory(req: Request, res: Response) {
    const userId = (req.headers['x-user-id'] as string) || 'system';
    await categoryService.deleteCategory(req.params.id, userId);
    res.status(200).json(successResponse(null, 'Category deleted successfully'));
  }
}

export const categoryController = new CategoryController();
