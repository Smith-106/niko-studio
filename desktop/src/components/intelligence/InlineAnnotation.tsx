import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Lightbulb } from 'lucide-react';
import type { DimensionResult } from '../../api/writing-craft';

interface InlineAnnotationProps {
  text: string;
  dimensions: DimensionResult[];
}

interface Annotation {
  start: number;
  end: number;
  text: string;
  type: 'evidence' | 'suggestion' | 'good';
  label: string;
}

type AnnotationSeverity = 'evidence' | 'suggestion' | 'good';

const SEVERITY_STYLES: Record<AnnotationSeverity, { bg: string; border: string; icon: React.ReactNode }> = {
  evidence: {
    bg: 'rgba(245, 158, 11, 0.15)',
    border: '#d97706',
    icon: <AlertCircle size={12} className="text-yellow-500" />,
  },
  suggestion: {
    bg: 'rgba(239, 68, 68, 0.12)',
    border: '#dc2626',
    icon: <AlertCircle size={12} className="text-red-400" />,
  },
  good: {
    bg: 'rgba(16, 185, 129, 0.12)',
    border: '#059669',
    icon: <CheckCircle size={12} className="text-green-500" />,
  },
};

function findAnnotations(text: string, dimensions: DimensionResult[]): Annotation[] {
  const annotations: Annotation[] = [];

  for (const dim of dimensions) {
    for (const ev of dim.evidence) {
      const keywords = ev.split(/[，、：:]/).filter((k) => k.length >= 2 && k.length <= 8);
      for (const kw of keywords) {
        const idx = text.indexOf(kw);
        if (idx !== -1) {
          annotations.push({
            start: idx,
            end: idx + kw.length,
            text: kw,
            type: 'evidence',
            label: `[${dim.label}] ${ev}`,
          });
        }
      }
    }
  }

  annotations.sort((a, b) => a.start - b.start);
  return annotations;
}

export const InlineAnnotation: React.FC<InlineAnnotationProps> = ({ text, dimensions }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const annotations = useMemo(() => findAnnotations(text, dimensions), [text, dimensions]);

  if (annotations.length === 0) {
    return (
      <div className="text-xs text-dark-text-muted py-2">
        <Lightbulb size={12} className="inline mr-1" />
        未检测到可标注的问题位置
      </div>
    );
  }

  const parts: Array<{ text: string; annotation?: Annotation; idx: number }> = [];
  let lastEnd = 0;

  annotations.forEach((ann, i) => {
    if (ann.start > lastEnd) {
      parts.push({ text: text.slice(lastEnd, ann.start), idx: i * 2 });
    }
    parts.push({ text: ann.text, annotation: ann, idx: i * 2 + 1 });
    lastEnd = ann.end;
  });

  if (lastEnd < text.length) {
    parts.push({ text: text.slice(lastEnd), idx: parts.length * 2 });
  }

  return (
    <div className="relative">
      <div className="text-sm leading-7 text-dark-text whitespace-pre-wrap">
        {parts.map((part) => {
          if (!part.annotation) {
            return <span key={part.idx}>{part.text}</span>;
          }
          const style = SEVERITY_STYLES[part.annotation.type];
          const isActive = activeIndex === part.idx;
          return (
            <span
              key={part.idx}
              className="relative cursor-pointer rounded-sm px-0.5"
              style={{ backgroundColor: style.bg, borderBottom: `2px solid ${style.border}` }}
              onClick={() => setActiveIndex(isActive ? null : part.idx)}
            >
              {part.text}
              {isActive && (
                <span
                  className="absolute bottom-full left-0 mb-1 px-2 py-1 rounded text-xs whitespace-nowrap z-10"
                  style={{ backgroundColor: '#1e1e2e', color: '#cdd6f4', maxWidth: '300px' }}
                >
                  {style.icon} {part.annotation.label}
                </span>
              )}
            </span>
          );
        })}
      </div>
      <div className="text-xs text-dark-text-muted mt-1">
        共 {annotations.length} 处标注，点击查看详情
      </div>
    </div>
  );
};
