import { prisma } from '../../infrastructure/database';
import type { ColumnMap, FieldDefaults } from './import.service';

export type ImportMappingType = 'properties' | 'tenants' | 'leases' | 'expenses';

export async function getImportMapping(userId: string, importType: ImportMappingType) {
  const row = await prisma.importMapping.findUnique({
    where: { userId_importType: { userId, importType } },
  });
  if (!row) return null;
  return {
    columnMap: row.columnMap as ColumnMap,
    defaults: row.defaults as FieldDefaults,
  };
}

export async function saveImportMapping(
  userId: string,
  importType: ImportMappingType,
  columnMap: ColumnMap,
  defaults?: FieldDefaults,
): Promise<void> {
  if (!Object.keys(columnMap).length) return;
  await prisma.importMapping.upsert({
    where: { userId_importType: { userId, importType } },
    create: { userId, importType, columnMap: columnMap as object, defaults: (defaults ?? {}) as object },
    update: { columnMap: columnMap as object, defaults: (defaults ?? {}) as object },
  });
}
