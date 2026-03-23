import { useMemo, useState } from "react";
import { Search, Star, X } from "lucide-react";
import type {
  PromptTemplate,
  PromptTemplateCategory,
} from "../stores/settingsStore";
import { useI18n } from "../i18n";

export interface ApplyTemplatePayload {
  text: string;
  mode: "replace" | "append";
  templateId: string;
  variableValues: Record<string, string>;
}

interface PromptTemplatePanelProps {
  templates: PromptTemplate[];
  variablePresets: Record<string, Record<string, string>>;
  onToggleFavorite: (templateId: string) => void;
  onApplyTemplate: (payload: ApplyTemplatePayload) => void;
  onClose: () => void;
}

const categoryOrder: Array<"all" | PromptTemplateCategory> = [
  "all",
  "brainstorm",
  "outline",
  "character",
  "rewrite",
  "analysis",
  "custom",
];

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const renderTemplateContent = (
  template: PromptTemplate,
  values: Record<string, string>,
): string => {
  let next = template.content;
  for (const variable of template.variables) {
    const key = `{${variable.id}}`;
    const reg = new RegExp(escapeRegExp(key), "g");
    next = next.replace(reg, values[variable.id] ?? "");
  }
  return next;
};

export function PromptTemplatePanel({
  templates,
  variablePresets,
  onToggleFavorite,
  onApplyTemplate,
  onClose,
}: PromptTemplatePanelProps) {
  const { t } = useI18n();
  const [selectedCategory, setSelectedCategory] = useState<
    "all" | PromptTemplateCategory
  >("all");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    templates[0]?.id ?? "",
  );
  const [applyMode, setApplyMode] = useState<"replace" | "append">("replace");
  const [variableValues, setVariableValues] = useState<Record<string, string>>(
    {},
  );
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  const filteredTemplates = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    return templates.filter((template) => {
      if (
        selectedCategory !== "all" &&
        template.category !== selectedCategory
      ) {
        return false;
      }
      if (favoriteOnly && !template.isFavorite) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return (
        template.title.toLowerCase().includes(keyword) ||
        template.content.toLowerCase().includes(keyword)
      );
    });
  }, [favoriteOnly, searchKeyword, selectedCategory, templates]);

  const selectedTemplate = useMemo(
    () =>
      filteredTemplates.find(
        (template) => template.id === selectedTemplateId,
      ) ?? filteredTemplates[0],
    [filteredTemplates, selectedTemplateId],
  );

  const resolveVariableValue = (
    template: PromptTemplate,
    variableId: string,
  ): string => {
    if (variableValues[variableId] !== undefined) {
      return variableValues[variableId];
    }
    const preset = variablePresets[template.id]?.[variableId];
    if (preset !== undefined) {
      return preset;
    }
    const variable = template.variables.find((item) => item.id === variableId);
    return variable?.defaultValue ?? "";
  };

  const handleApply = () => {
    if (!selectedTemplate) return;

    const nextValues: Record<string, string> = {};
    const nextErrors: Record<string, string> = {};

    for (const variable of selectedTemplate.variables) {
      const value = resolveVariableValue(selectedTemplate, variable.id).trim();
      if (variable.required && !value) {
        nextErrors[variable.id] = t.templateRequiredHint;
      }
      nextValues[variable.id] = value;
    }

    setValidationErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const text = renderTemplateContent(selectedTemplate, nextValues);
    onApplyTemplate({
      text,
      mode: applyMode,
      templateId: selectedTemplate.id,
      variableValues: nextValues,
    });
  };

  return (
    <div
      className="fixed right-0 top-14 bottom-0 w-[420px] bg-slate-50 dark:bg-dark-bg border-l border-gray-200 dark:border-dark-border shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.1)] flex flex-col z-30 transform transition-transform"
      role="dialog"
      aria-modal="true"
      aria-label={t.templateLibraryTitle}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-border bg-white/80 dark:bg-dark-surface/80 backdrop-blur-md">
        <div className="font-semibold text-gray-800 dark:text-dark-text tracking-wide">
          {t.templateLibraryTitle}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-text focus:outline-none rounded-md p-1 hover:bg-gray-200 dark:hover:bg-dark-surface2 transition-colors"
          aria-label={t.templateClosePanel}
        >
          <X size={18} />
        </button>
      </div>

      <div className="p-4 border-b border-gray-200 dark:border-dark-border space-y-3 bg-white dark:bg-dark-bg">
        <div className="flex flex-wrap gap-2">
          {categoryOrder.map((category) => {
            const labelMap: Record<(typeof categoryOrder)[number], string> = {
              all: t.templateCategoryAll,
              brainstorm: t.templateCategoryBrainstorm,
              outline: t.templateCategoryOutline,
              character: t.templateCategoryCharacter,
              rewrite: t.templateCategoryRewrite,
              analysis: t.templateCategoryAnalysis,
              custom: t.templateCategoryCustom,
            };
            const label = labelMap[category];
            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider rounded-full transition-all active:scale-95 ${
                  selectedCategory === category
                    ? "bg-primary-600 text-white shadow-sm"
                    : "bg-gray-100 hover:bg-gray-200 dark:bg-dark-surface dark:hover:bg-dark-border text-gray-600 dark:text-dark-text"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFavoriteOnly((prev) => !prev)}
            className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-all flex items-center gap-1.5 active:scale-95 shadow-sm ${
              favoriteOnly
                ? "bg-amber-500 text-white border border-transparent"
                : "bg-white dark:bg-dark-surface hover:bg-gray-50 dark:hover:bg-dark-surface2 border border-gray-200 dark:border-dark-border text-gray-700 dark:text-dark-text"
            }`}
          >
            <Star size={14} className={favoriteOnly ? "fill-current" : ""} />
            {favoriteOnly
              ? t.templateFavoriteOnlyOn
              : t.templateFavoriteOnlyOff}
          </button>
        </div>

        <div className="relative pt-1">
          <Search size={16} className="absolute left-3 top-3.5 text-gray-400" />
          <input
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            placeholder={t.templateSearchPlaceholder}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-surface text-gray-800 dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden grid grid-cols-5 bg-slate-50 dark:bg-dark-bg">
        <div className="col-span-2 border-r border-gray-200 dark:border-dark-border overflow-y-auto custom-scrollbar bg-white dark:bg-dark-bg">
          {filteredTemplates.length === 0 ? (
            <div className="p-4 text-xs text-center text-gray-500 dark:text-dark-text-muted italic">
              {t.templateNoMatch}
            </div>
          ) : (
            <ul className="p-2 space-y-1.5">
              {filteredTemplates.map((template) => {
                const selected = selectedTemplate?.id === template.id;
                return (
                  <li key={template.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedTemplateId(template.id);
                        setValidationErrors({});
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedTemplateId(template.id);
                          setValidationErrors({});
                        }
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer shadow-sm hover:shadow-md ${
                        selected
                          ? "border-primary-500 bg-primary-50/50 dark:bg-primary-900/10"
                          : "border-transparent hover:border-gray-200 dark:hover:border-dark-border bg-white dark:bg-dark-surface"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`text-[13px] font-semibold tracking-wide truncate ${selected ? "text-primary-700 dark:text-primary-400" : "text-gray-800 dark:text-dark-text"}`}
                        >
                          {template.title}
                        </span>
                        <button
                          type="button"
                          aria-label={
                            template.isFavorite
                              ? t.templateUnfavorite
                              : t.templateFavorite
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleFavorite(template.id);
                          }}
                          className={`cursor-pointer shrink-0 transition-colors p-1 -m-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 ${template.isFavorite ? "text-amber-500" : "text-gray-300 dark:text-gray-600 hover:text-amber-400"}`}
                        >
                          <Star
                            size={14}
                            fill={template.isFavorite ? "currentColor" : "none"}
                          />
                        </button>
                      </div>
                      <p
                        className={`mt-1.5 text-[11px] line-clamp-2 leading-relaxed ${selected ? "text-primary-600/80 dark:text-primary-400/80" : "text-gray-500 dark:text-dark-text-secondary"}`}
                      >
                        {template.content}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="col-span-3 p-4 overflow-y-auto custom-scrollbar">
          {!selectedTemplate ? (
            <div className="text-sm text-center text-gray-500 dark:text-dark-text-muted italic mt-10">
              {t.templateEmptyList}
            </div>
          ) : (
            <div className="space-y-5 animate-fade-in">
              <h3 className="text-[15px] font-bold text-gray-800 dark:text-dark-text border-b border-gray-200 dark:border-dark-border pb-3">
                {selectedTemplate.title}
              </h3>

              <div className="space-y-4">
                {selectedTemplate.variables.map((variable) => {
                  const value = resolveVariableValue(
                    selectedTemplate,
                    variable.id,
                  );
                  return (
                    <div
                      key={variable.id}
                      className="bg-white dark:bg-dark-surface p-3 rounded-xl border border-gray-100 dark:border-dark-border/50 shadow-sm"
                    >
                      <label
                        htmlFor={`template-var-${variable.id}`}
                        className="block text-[11px] font-semibold text-gray-600 dark:text-dark-text-secondary uppercase tracking-wider mb-2"
                      >
                        {variable.label}
                        {variable.required ? " *" : ""}
                      </label>
                      <input
                        id={`template-var-${variable.id}`}
                        value={value}
                        onChange={(event) => {
                          setVariableValues((prev) => ({
                            ...prev,
                            [variable.id]: event.target.value,
                          }));
                          setValidationErrors((prev) => {
                            const { [variable.id]: _ignored, ...rest } = prev;
                            return rest;
                          });
                        }}
                        placeholder={
                          variable.description || variable.defaultValue || ""
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-800 dark:text-dark-text rounded-md focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all"
                      />
                      {validationErrors[variable.id] && (
                        <p className="mt-2 text-xs font-medium text-danger-500">
                          {validationErrors[variable.id]}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-dark-border">
                <div className="flex items-center gap-3 mb-4 bg-gray-100/50 dark:bg-dark-surface/50 p-1 rounded-lg w-fit">
                  <button
                    onClick={() => setApplyMode("replace")}
                    className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                      applyMode === "replace"
                        ? "bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border shadow-sm text-gray-900 dark:text-white"
                        : "text-gray-500 dark:text-dark-text-muted hover:text-gray-700 dark:hover:text-dark-text"
                    }`}
                  >
                    {t.templateApplyReplace}
                  </button>
                  <button
                    onClick={() => setApplyMode("append")}
                    className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                      applyMode === "append"
                        ? "bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border shadow-sm text-gray-900 dark:text-white"
                        : "text-gray-500 dark:text-dark-text-muted hover:text-gray-700 dark:hover:text-dark-text"
                    }`}
                  >
                    {t.templateApplyAppend}
                  </button>
                </div>

                <button
                  onClick={handleApply}
                  className="w-full px-4 py-2.5 text-sm font-bold tracking-wide rounded-xl bg-primary-600 text-white shadow-md hover:bg-primary-500 hover:shadow-lg active:scale-[0.98] transition-all flex justify-center items-center gap-2"
                >
                  <Star size={16} className="fill-current opacity-80" />
                  {t.templateApplyAction}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
