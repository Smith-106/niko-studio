import { Link } from 'react-router-dom';
import { categories, getPagesByCategory } from '../data/inventory';
import type { Category } from '../data/inventory';

export default function LandingPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-[28px] font-bold text-[var(--color-text-primary)] mb-2 leading-[1.3]">
          Niko Studio 文档
        </h1>
        <p className="text-base text-[var(--color-text-secondary)] leading-relaxed max-w-[520px]">
          AI 驱动的写作助手，提供写作技法分析、叙事结构识别、角色画像生成等智能辅助功能。
        </p>
      </div>

      <div className="mb-8 p-5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
          快速开始
        </h2>
        <ol className="flex flex-col gap-2 list-decimal list-inside text-[13px] text-[var(--color-text-secondary)]">
          <li>安装 Niko Studio 桌面应用</li>
          <li>导入或创建你的写作项目</li>
          <li>使用写作智能面板分析文本</li>
          <li>根据分析建议优化你的作品</li>
        </ol>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {categories.map((category) => (
          <CategoryCard key={category.id} category={category} />
        ))}
      </div>
    </div>
  );
}

const tintColors: Record<string, string> = {
  'getting-started': 'bg-[var(--color-tint-green)]',
  writing: 'bg-[var(--color-tint-purple)]',
  knowledge: 'bg-[var(--color-tint-blue)]',
  desktop: 'bg-[var(--color-tint-orange)]',
  architecture: 'bg-[var(--color-tint-gray)]',
  api: 'bg-[var(--color-tint-yellow)]',
};

function CategoryCard({ category }: { category: Category }) {
  const pages = getPagesByCategory(category.id);
  const tint = tintColors[category.id] || 'bg-[var(--color-tint-gray)]';

  return (
    <Link
      to={`/${category.id}`}
      className="block p-5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl no-underline transition-all duration-[180ms] hover:border-[var(--color-text-placeholder)] hover:-translate-y-[2px] hover:shadow-[var(--shadow-md)]"
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${tint}`}>
        <span className="text-[18px]">{category.icon}</span>
      </div>
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
        {category.name}
      </h3>
      <p className="text-[12px] text-[var(--color-text-secondary)] leading-normal line-clamp-2">
        {category.description}
      </p>
      <span className="inline-block mt-2 text-[11px] text-[var(--color-text-tertiary)]">
        {pages.length} 篇文档
      </span>
    </Link>
  );
}
