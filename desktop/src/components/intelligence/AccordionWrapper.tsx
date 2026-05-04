import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionItem {
  id: string;
  header: React.ReactNode;
  content: React.ReactNode;
}

interface AccordionWrapperProps {
  items: AccordionItem[];
  mode: 'single' | 'multi';
}

export const AccordionWrapper: React.FC<AccordionWrapperProps> = ({ items, mode }) => {
  const [expanded, setExpanded] = useState<string | string[] | null>(mode === 'single' ? null : []);

  const toggle = (id: string) => {
    if (mode === 'single') {
      setExpanded(expanded === id ? null : id);
    } else {
      setExpanded((current) =>
        (current as string[]).includes(id)
          ? (current as string[]).filter((item) => item !== id)
          : [...(current as string[]), id]
      );
    }
  };

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const isExpanded = mode === 'single' ? expanded === item.id : (expanded as string[]).includes(item.id);
        return (
          <div key={item.id} className="border-b border-dark-border">
            <button
              onClick={() => toggle(item.id)}
              className="w-full flex justify-between items-center py-2 text-left"
            >
              {item.header}
              <ChevronDown
                size={16}
                className={`transform transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}
              />
            </button>
            <div
              className="overflow-hidden transition-all duration-150 ease-in-out"
              style={{ maxHeight: isExpanded ? '1000px' : '0' }}
            >
              <div className="py-2">{item.content}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
