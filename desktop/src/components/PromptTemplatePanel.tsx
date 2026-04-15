import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Search, Star, X } from "lucide-react";
import type {
  PromptTemplate,
  PromptTemplateCategory,
} from "../stores/settingsStore";
import { useI18n } from "../i18n";
import {
  useDialogFocusTrap,
  type DialogCloseReason,
} from "../hooks/useDialogFocusTrap";

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
  onClose: (reason?: DialogCloseReason) => void;
  restoreFocusRef?: RefObject<HTMLElement | null>;
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
  restoreFocusRef,
}: PromptTemplatePanelProps) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const scrimPointerDownRef = useRef(false);
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
  const [pendingFocusVariableId, setPendingFocusVariableId] = useState<
    string | null
  >(null);
  const titleId = "prompt-template-panel-title";
  const templateListId = "prompt-template-list";

  useDialogFocusTrap({
    containerRef: dialogRef,
    onClose,
    initialFocusRef: searchInputRef,
    restoreFocusRef,
  });

  useEffect(() => {
    if (
      pendingFocusVariableId === null ||
      validationErrors[pendingFocusVariableId] === undefined
    ) {
      return;
    }

    const input = document.getElementById(
      `template-var-${pendingFocusVariableId}`,
    );
    if (input instanceof HTMLInputElement) {
      input.focus();
    }

    setPendingFocusVariableId(null);
  }, [pendingFocusVariableId, validationErrors]);

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

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setValidationErrors({});
    setPendingFocusVariableId(null);
  };

  const handleApply = () => {
    if (!selectedTemplate) return;

    const nextValues: Record<string, string> = {};
    const nextErrors: Record<string, string> = {};
    let firstInvalidVariableId: string | null = null;

    for (const variable of selectedTemplate.variables) {
      const value = resolveVariableValue(selectedTemplate, variable.id).trim();
      if (variable.required && !value) {
        nextErrors[variable.id] = t.templateRequiredHint;
        if (firstInvalidVariableId === null) {
          firstInvalidVariableId = variable.id;
        }
      }
      nextValues[variable.id] = value;
    }

    setValidationErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setPendingFocusVariableId(firstInvalidVariableId);
      return;
    }

    setPendingFocusVariableId(null);
    const text = renderTemplateContent(selectedTemplate, nextValues);
    onApplyTemplate({
      text,
      mode: applyMode,
      templateId: selectedTemplate.id,
      variableValues: nextValues,
    });
  };

  const handleScrimMouseDown = () => {
    scrimPointerDownRef.current = true;
  };

  const handleScrimClick = () => {
    if (!scrimPointerDownRef.current) {
      return;
    }

    scrimPointerDownRef.current = false;
    onClose("backdrop");
  };

  return (
    <div className="fixed inset-x-0 top-14 bottom-0 z-30 flex justify-end">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-slate-900/20"
        onMouseDown={handleScrimMouseDown}
        onClick={handleScrimClick}
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative flex h-full w-[420px] flex-col border-l border-gray-200 bg-slate-50 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.1)] transform transition-transform dark:border-dark-border dark:bg-dark-bg"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-border bg-white/80 dark:bg-dark-surface/80 backdrop-blur-md">
        <h2 id={titleId} className="font-semibold text-gray-800 dark:text-dark-text tracking-wide">
          {t.templateLibraryTitle}
        </h2>
        <button
          type="button"
          onClick={() => onClose("close-button")}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-dark-surface rounded-md p-1 hover:bg-gray-200 dark:hover:bg-dark-surface2 transition-colors"
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
                type="button"
                aria-pressed={selectedCategory === category}
                aria-controls={templateListId}
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
            type="button"
            aria-pressed={favoriteOnly}
            aria-controls={templateListId}
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
            ref={searchInputRef}
            aria-label={t.templateSearchPlaceholder}
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
            <ul id={templateListId} className="p-2 space-y-1.5">
              {filteredTemplates.map((template) => {
                const selected = selectedTemplate?.id === template.id;
                return (
                  <li key={template.id}>
                    <div
                      className={`flex items-start gap-2 rounded-xl border p-3 transition-all shadow-sm hover:shadow-md ${
                        selected
                          ? "border-primary-500 bg-primary-50/50 dark:bg-primary-900/10"
                          : "border-transparent hover:border-gray-200 dark:hover:border-dark-border bg-white dark:bg-dark-surface"
                      }`}
                    >
                      <button
                        type="button"
                        aria-current={selected ? "true" : undefined}
                        onClick={() => handleTemplateSelect(template.id)}
                        className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                      >
                        <span
                          className={`block truncate text-[13px] font-semibold tracking-wide ${selected ? "text-primary-700 dark:text-primary-400" : "text-gray-800 dark:text-dark-text"}`}
                        >
                          {template.title}
                        </span>
                        <p
                          className={`mt-1.5 text-[11px] line-clamp-2 leading-relaxed ${selected ? "text-primary-600/80 dark:text-primary-400/80" : "text-gray-500 dark:text-dark-text-secondary"}`}
                        >
                          {template.content}
                        </p>
                      </button>
                      <button
                        type="button"
                        aria-label={
                          template.isFavorite
                            ? t.templateUnfavorite
                            : t.templateFavorite
                        }
                        onClick={() => onToggleFavorite(template.id)}
                        className={`cursor-pointer shrink-0 self-start transition-colors p-1 -m-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 ${template.isFavorite ? "text-amber-500" : "text-gray-300 dark:text-gray-600 hover:text-amber-400"}`}
                      >
                        <Star
                          size={14}
                          fill={template.isFavorite ? "currentColor" : "none"}
                        />
                      </button>
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
                  const inputId = `template-var-${variable.id}`;
                  const errorId = `template-var-error-${variable.id}`;
                  const error = validationErrors[variable.id];
                  return (
                    <div
                      key={variable.id}
                      className="bg-white dark:bg-dark-surface p-3 rounded-xl border border-gray-100 dark:border-dark-border/50 shadow-sm"
                    >
                      <label
                        htmlFor={inputId}
                        className="block text-[11px] font-semibold text-gray-600 dark:text-dark-text-secondary uppercase tracking-wider mb-2"
                      >
                        {variable.label}
                        {variable.required ? " *" : ""}
                      </label>
                      <input
                        id={inputId}
                        value={value}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? errorId : undefined}
                        onChange={(event) => {
                          setVariableValues((prev) => ({
                            ...prev,
                            [variable.id]: event.target.value,
                          }));
                          setPendingFocusVariableId((prev) =>
                            prev === variable.id ? null : prev,
                          );
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
                      {error && (
                        <p
                          id={errorId}
                          role="alert"
                          className="mt-2 text-xs font-medium text-danger-500"
                        >
                          {error}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-dark-border">
                <div className="flex items-center gap-3 mb-4 bg-gray-100/50 dark:bg-dark-surface/50 p-1 rounded-lg w-fit">
                  <button
                    type="button"
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
                    type="button"
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
                  type="button"
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
    </div>
  );
}
