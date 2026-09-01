import {
  BUILTIN_CATEGORIES,
  BUILTIN_CATEGORY_KEYS,
  isBuiltinCategoryKey,
  type BuiltinCategoryKey,
  type CategoryDTO,
} from "@/lib/categories";
import { prisma } from "@/lib/db";

export function toCategoryDTO(c: {
  id: string;
  key: string;
  label: string;
  sortOrder: number;
}): CategoryDTO {
  return {
    id: c.id,
    key: c.key,
    label: c.label,
    sortOrder: c.sortOrder,
  };
}

/** Ensure built-in categories exist and backfill PersonCategory from boolean columns once. */
export async function ensureCategories() {
  for (let i = 0; i < BUILTIN_CATEGORIES.length; i++) {
    const cat = BUILTIN_CATEGORIES[i];
    await prisma.category.upsert({
      where: { key: cat.key },
      create: {
        key: cat.key,
        label: cat.label,
        sortOrder: i,
      },
      update: {
        label: cat.label,
        sortOrder: i,
      },
    });
  }

  const meta = await prisma.appMeta.findUnique({
    where: { key: "categories_backfilled" },
  });
  if (meta?.value === "1") return;

  const categories = await prisma.category.findMany({
    where: { key: { in: [...BUILTIN_CATEGORY_KEYS] } },
  });
  const byKey = new Map(categories.map((c) => [c.key, c.id]));

  const people = await prisma.person.findMany({
    select: {
      id: true,
      ...Object.fromEntries(BUILTIN_CATEGORY_KEYS.map((k) => [k, true])),
    },
  });

  for (const person of people) {
    for (const key of BUILTIN_CATEGORY_KEYS) {
      if (!(person as Record<string, unknown>)[key]) continue;
      const categoryId = byKey.get(key);
      if (!categoryId) continue;
      await prisma.personCategory.upsert({
        where: {
          personId_categoryId: { personId: person.id, categoryId },
        },
        create: { personId: person.id, categoryId },
        update: {},
      });
    }
  }

  await prisma.appMeta.upsert({
    where: { key: "categories_backfilled" },
    create: { key: "categories_backfilled", value: "1" },
    update: { value: "1" },
  });
}

export async function getCategories(): Promise<CategoryDTO[]> {
  await ensureCategories();
  const rows = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return rows.map(toCategoryDTO);
}

/** Replace a person's category memberships; mirrors built-in keys onto Person booleans. */
export async function setPersonCategoryKeys(
  personId: string,
  keys: string[],
  editorName?: string,
) {
  const uniqueKeys = [...new Set(keys.filter(Boolean))];
  const categories = await prisma.category.findMany({
    where: { key: { in: uniqueKeys } },
  });
  const found = new Set(categories.map((c) => c.key));
  const missing = uniqueKeys.filter((k) => !found.has(k));
  if (missing.length) {
    throw new Error(`Unknown categor${missing.length === 1 ? "y" : "ies"}: ${missing.join(", ")}`);
  }

  await prisma.personCategory.deleteMany({ where: { personId } });
  if (categories.length) {
    await prisma.personCategory.createMany({
      data: categories.map((c) => ({
        personId,
        categoryId: c.id,
      })),
    });
  }

  const boolData = Object.fromEntries(
    BUILTIN_CATEGORY_KEYS.map((key) => [key, uniqueKeys.includes(key)]),
  ) as Record<BuiltinCategoryKey, boolean>;

  await prisma.person.update({
    where: { id: personId },
    data: {
      ...boolData,
      ...(editorName ? { lastEditedBy: editorName } : {}),
    },
  });
}

export async function addCategoriesToPeople(
  personIds: string[],
  keys: string[],
  editorName: string,
) {
  const uniqueKeys = [...new Set(keys.filter(Boolean))];
  if (!uniqueKeys.length || !personIds.length) return;
  const categories = await prisma.category.findMany({
    where: { key: { in: uniqueKeys } },
  });
  for (const personId of personIds) {
    for (const cat of categories) {
      await prisma.personCategory.upsert({
        where: {
          personId_categoryId: { personId, categoryId: cat.id },
        },
        create: { personId, categoryId: cat.id },
        update: {},
      });
    }
    const boolPatch = Object.fromEntries(
      uniqueKeys
        .filter(isBuiltinCategoryKey)
        .map((key) => [key, true]),
    );
    await prisma.person.update({
      where: { id: personId },
      data: { ...boolPatch, lastEditedBy: editorName },
    });
  }
}

export async function removeCategoriesFromPeople(
  personIds: string[],
  keys: string[],
  editorName: string,
) {
  const uniqueKeys = [...new Set(keys.filter(Boolean))];
  if (!uniqueKeys.length || !personIds.length) return;
  const categories = await prisma.category.findMany({
    where: { key: { in: uniqueKeys } },
  });
  const categoryIds = categories.map((c) => c.id);
  await prisma.personCategory.deleteMany({
    where: {
      personId: { in: personIds },
      categoryId: { in: categoryIds },
    },
  });
  const boolPatch = Object.fromEntries(
    uniqueKeys.filter(isBuiltinCategoryKey).map((key) => [key, false]),
  );
  await prisma.person.updateMany({
    where: { id: { in: personIds } },
    data: { ...boolPatch, lastEditedBy: editorName },
  });
}
