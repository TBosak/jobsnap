import { useState } from "react";
import { X, FileText, CheckCircle } from "lucide-react";
import type { MultiSourceAnalysis, MultiSourceConflict } from "../utils/resume-merger";

interface MultiFileConflictModalProps {
  analysis: MultiSourceAnalysis;
  onConfirm: (selections: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function MultiFileConflictModal({ analysis, onConfirm, onCancel }: MultiFileConflictModalProps) {
  // Sanitize and normalize values from options
  function sanitizeValue(value: unknown): unknown {
    if (typeof value !== 'string') return value;

    let sanitized = value.trim();

    // Try to extract value from JSON key-value pair format
    // e.g., '"url": "https://example.com"' or '"url": "https://example.com",' -> 'https://example.com'
    const jsonPairMatch = sanitized.match(/^"[^"]+"\s*:\s*"([^"]+)"\s*,?$/);
    if (jsonPairMatch) {
      sanitized = jsonPairMatch[1];
      return sanitized;
    }

    // Remove surrounding quotes if present
    if (sanitized.startsWith('"') && sanitized.endsWith('"')) {
      sanitized = sanitized.slice(1, -1);
    }

    // Remove trailing comma if present
    if (sanitized.endsWith(',')) {
      sanitized = sanitized.slice(0, -1);
    }

    return sanitized;
  }

  // Initialize selections with first option for each conflict
  const initialSelections = analysis.conflicts.reduce((acc, conflict) => {
    const firstValue = conflict.options[0]?.value;
    acc[conflict.field] = sanitizeValue(firstValue);
    return acc;
  }, {} as Record<string, unknown>);

  const [selections, setSelections] = useState<Record<string, unknown>>(initialSelections);

  function handleOptionSelect(field: string, value: unknown) {
    setSelections(prev => ({ ...prev, [field]: sanitizeValue(value) }));
  }

  function handleConfirm() {
    onConfirm(selections);
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-peach/30 via-lavender/30 to-mint/30">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Resolve Conflicts
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Multiple files contain different values for the same fields. Choose which value to use for each field.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg text-slate-500 hover:bg-white hover:text-slate-700 transition-all duration-base focus:outline-none focus:ring-2 focus:ring-mint/30"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-180px)] p-6 space-y-6">
          {analysis.conflicts.map((conflict, conflictIndex) => (
            <div
              key={conflict.field}
              className="border border-slate-200 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50"
            >
              {/* Field Name */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-peach to-lavender text-white text-sm font-bold">
                  {conflictIndex + 1}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {formatFieldName(conflict.field)}
                  </h3>
                  <p className="text-xs text-slate-500">{conflict.section}</p>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-3">
                {conflict.options.map((option, optionIndex) => {
                  const sanitizedValue = sanitizeValue(option.value);
                  const isSelected = selections[conflict.field] === sanitizedValue;
                  return (
                    <button
                      key={optionIndex}
                      type="button"
                      onClick={() => handleOptionSelect(conflict.field, option.value)}
                      className={`
                        w-full text-left p-4 rounded-lg border-2 transition-all duration-base
                        ${
                          isSelected
                            ? 'border-mint bg-gradient-to-r from-mint/10 to-sky/10 shadow-md'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                        }
                      `}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          {/* Source Label */}
                          <div className="flex items-center gap-2 mb-2">
                            <FileText size={14} className="text-slate-400" />
                            <span className="text-xs font-medium text-slate-600">
                              {option.source}
                            </span>
                          </div>

                          {/* Value - display sanitized version */}
                          <p className="text-sm text-slate-900 font-medium break-words">
                            {String(sanitizedValue)}
                          </p>
                        </div>

                        {/* Selection Indicator */}
                        {isSelected && (
                          <CheckCircle
                            size={20}
                            className="text-mint flex-shrink-0 mt-1"
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* No Conflicts Message */}
          {analysis.conflicts.length === 0 && (
            <div className="p-6 bg-slate-50 rounded-lg border border-slate-200 text-center">
              <CheckCircle className="text-green-600 mx-auto mb-2" size={32} />
              <p className="text-slate-600">
                No conflicts detected. All fields have consistent values across files.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 flex gap-3">
          <button
            onClick={onCancel}
            className="
              flex-1 rounded-full border-2 border-slate-300
              px-6 py-3 text-sm font-semibold text-slate-700
              transition-all duration-base
              hover:border-slate-400 hover:bg-white hover:scale-105
              active:scale-95
              focus:outline-none focus:ring-2 focus:ring-slate-500/20
            "
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="
              flex-1 rounded-full bg-gradient-to-r from-mint to-sky
              px-6 py-3 text-sm font-semibold text-slate-900
              shadow-md shadow-mint/30
              transition-all duration-base
              hover:shadow-lg hover:shadow-mint/40 hover:scale-105
              active:scale-95
              focus:outline-none focus:ring-2 focus:ring-mint/50 focus:ring-offset-2
            "
          >
            Apply Selections ({analysis.conflicts.length})
          </button>
        </div>
      </div>
    </div>
  );
}

function formatFieldName(field: string): string {
  // Convert camelCase to Title Case
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}
