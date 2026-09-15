/**
 * Category matcher for the bulk import (spec §4).
 *
 * Applies the same matching semantics as ProductService.resolveCategoryId,
 * but against a preloaded in-memory category list so a whole import needs
 * exactly one category query (no per-row DB access).
 *
 * Deliberate difference from resolveCategoryId: raw UUIDs are NOT trusted
 * blindly. For imports, a category id must exist in the preloaded set;
 * unknown ids (or names) produce a row error instead of a future FK failure.
 */

import prisma from '../../config/database';
import { CategoryMatch, CategoryMatcher } from './product-row.validator';

interface CategoryEntry {
  id: string;
  name: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Pure matcher over a preloaded category list.
 * Order of attempts mirrors resolveCategoryId: exact/case-insensitive name
 * first, then slug-style comparison (whitespace/underscore/dash stripped on
 * the input; whitespace/ampersand/dash stripped on the category name).
 */
export function makeCategoryMatcher(categories: CategoryEntry[]): CategoryMatcher {
  return (input: string): CategoryMatch => {
    const trimmed = input.trim();
    if (!trimmed) return { resolved: false };

    // Strict id handling: the id must exist in the preloaded set.
    if (UUID_REGEX.test(trimmed)) {
      const byId = categories.find((c) => c.id.toLowerCase() === trimmed.toLowerCase());
      return byId
        ? { resolved: true, categoryId: byId.id, categoryName: byId.name }
        : { resolved: false };
    }

    const normalized = trimmed.toLowerCase();
    for (const cat of categories) {
      if (cat.name.toLowerCase() === normalized) {
        return { resolved: true, categoryId: cat.id, categoryName: cat.name };
      }
    }

    // Slug-style matching (same charset quirks as resolveCategoryId).
    const noSpaceFilter = trimmed.replace(/[\s-_]/g, '').toLowerCase();
    for (const cat of categories) {
      const catNameNoSpace = cat.name.replace(/[\s-&]/g, '').toLowerCase();
      if (catNameNoSpace === noSpaceFilter) {
        return { resolved: true, categoryId: cat.id, categoryName: cat.name };
      }
    }

    return { resolved: false };
  };
}

/**
 * Preload all categories once and return the matcher.
 * One DB read per validation request — never per row.
 */
export async function buildCategoryMatcher(): Promise<CategoryMatcher> {
  const categories = await prisma.category.findMany({
    select: { id: true, name: true },
  });
  return makeCategoryMatcher(categories);
}
