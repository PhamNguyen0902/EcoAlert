export interface IBaseDocument {
  _id: any;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  deletedAt: Date | null;
  isDeleted: boolean;
}
