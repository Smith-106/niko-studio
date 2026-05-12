import { categories, docPages } from '../data/inventory';
import type { Category, DocPage } from '../data/inventory';

export { categories, docPages };
export type { Category, DocPage };

export function getPageSlug(page: DocPage): string {
  return page.slug;
}

export function getCategoryById(id: string): Category | undefined {
  return categories.find((c) => c.id === id);
}
