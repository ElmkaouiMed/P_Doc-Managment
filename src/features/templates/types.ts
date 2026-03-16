import { DocumentType, TemplateFormat } from "@prisma/client";

export type TemplateAssetRow = {
  id: string;
  documentType: DocumentType;
  name: string;
  description: string;
  format: TemplateFormat;
  isDefault: boolean;
  isActive: boolean;
  versionNumber: number;
  fileName: string;
  fileSize: number;
  variables: string[];
  uploadedAt: string;
  updatedAt: string;
};
