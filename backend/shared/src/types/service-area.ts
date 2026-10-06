export type AreaPosition = [number, number];
export type AreaRing = AreaPosition[];
export type AreaPolygonCoordinates = AreaRing[];
export type AreaGeometry =
  | { type: "Polygon"; coordinates: AreaPolygonCoordinates }
  | { type: "MultiPolygon"; coordinates: AreaPolygonCoordinates[] };
export interface ServiceAreaData {
  _id: string;
  code: string;
  name: string;
  administrativeLevel: "WARD" | "DISTRICT" | "CUSTOM";
  parentCode?: string;
  geometry: AreaGeometry;
  assignedOfficerIds: string[];
  isActive: boolean;
  priority: number;
  createdAt?: Date;
  updatedAt?: Date;
}
export interface AreaMatchResult {
  area: ServiceAreaData | null;
  overlaps: Array<Pick<ServiceAreaData, "_id" | "code" | "name" | "priority">>;
}
export interface OfficerDirectoryData {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  isDeleted: boolean;
}
