import React, { useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import type { AnalysisTemplate } from '../../utils/analysis-templates';
import type { WritingCraftDimension } from '../../api/writing-craft';

type WeightableDimension = Exclude<WritingCraftDimension, 'hook' | 'cliffhanger'>;

const DIM_OPTIONS: { value: WeightableDimension; label: string }[] = [
  { value: 'structure', label: '结构' },
  { value: 'character', label: '角色' },
  { value: 'suspense', label: '悬疑' },
  { value: 'emotion', label: '情感' },
  { value: 'dialogue', label: '对话' },
  { value: 'webnovel', label: '网文' },
  { value: 'show_tell', label: 'Show/Tell' },
];

interface TemplateManagerProps {
  templates: AnalysisTemplate[];
  onSelect: (template: AnalysisTemplate) => void;
  onSave: (template: Omit<AnalysisTemplate, 'id'>) => void;
  onDelete: (id: string) => void;
}

export const TemplateManager: React.FC<TemplateManagerProps> = ({ templates, onSelect, onSave, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [selectedDims, setSelectedDims] = useState<Set<WeightableDimension>>(new Set());
  const [weights, setWeights] = useState<Record<WeightableDimension, number>>({
    structure: 1, character: 1, suspense: 1, emotion: 1, dialogue: 1, webnovel: 1, show_tell: 0,
  });

  const toggleDim = (dim: WeightableDimension) => {
    setSelectedDims((prev) => {
      const next = new Set(prev);
      if (next.has(dim)) next.delete(dim); else next.add(dim);
      return next;
    });
  };

  const handleSave = () => {
    if (!name.trim() || selectedDims.size === 0) return;
    onSave({
      name: name.trim(),
      dimensions: Array.from(selectedDims),
      weights,
    });
    setEditing(false);
    setName('');
    setSelectedDims(new Set());
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-dark-text-muted uppercase tracking-wider">分析模板</h3>
        <button
          onClick={() => setEditing(!editing)}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-dark-border text-dark-text-muted hover:bg-dark-surface-sunken"
        >
          <Plus size={12} /> 新建模板
        </button>
      </div>

      {templates.map((t) => (
        <div key={t.id} className="flex items-center justify-between px-2 py-1.5 rounded-md bg-dark-surface-sunken">
          <button onClick={() => onSelect(t)} className="text-xs text-dark-text hover:text-primary-cta text-left">
            {t.name}
            <span className="text-dark-text-muted ml-1">({t.dimensions.length} 维度)</span>
            {t.builtin && <span className="text-dark-text-muted ml-1">内置</span>}
          </button>
          {!t.builtin && (
            <button onClick={() => onDelete(t.id)} className="text-dark-text-muted hover:text-red-400">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      ))}

      {editing && (
        <div className="p-3 rounded-md border border-dark-border flex flex-col gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="模板名称"
            className="px-2 py-1 text-xs bg-dark-surface-sunken text-dark-text rounded border border-dark-border focus:outline-none"
          />
          <div className="flex gap-2 flex-wrap">
            {DIM_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-1 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedDims.has(opt.value)}
                  onChange={() => toggleDim(opt.value)}
                  className="w-3 h-3"
                />
                {opt.label}
              </label>
            ))}
          </div>
          {Array.from(selectedDims).map((dim) => (
            <div key={dim} className="flex items-center gap-2">
              <span className="text-xs text-dark-text-muted w-8">{DIM_OPTIONS.find((d) => d.value === dim)?.label}</span>
              <input
                type="range"
                min={0}
                max={3}
                step={1}
                value={weights[dim]}
                onChange={(e) => setWeights({ ...weights, [dim]: Number(e.target.value) })}
                className="flex-1"
              />
              <span className="text-xs text-dark-text-muted w-4">{weights[dim]}</span>
            </div>
          ))}
          <button
            onClick={handleSave}
            disabled={!name.trim() || selectedDims.size === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-primary-cta text-white
                       disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-cta-hover"
          >
            <Save size={12} /> 保存模板
          </button>
        </div>
      )}
    </div>
  );
};
