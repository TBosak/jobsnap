import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import type { MergePreview } from "../utils/resume-merger";

interface ImportPreviewModalProps {
  preview: MergePreview;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ImportPreviewModal({ preview, onConfirm, onCancel }: ImportPreviewModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {preview.hasConflicts ? 'Review Import Conflicts' : 'Import Preview'}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {preview.hasConflicts
                ? 'Some fields have conflicts - existing data will be preserved'
                : 'Review the data that will be added to your profile'}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="
              p-2 rounded-lg text-slate-500
              hover:bg-white hover:text-slate-700
              transition-all duration-base
              focus:outline-none focus:ring-2 focus:ring-indigo-500/20
            "
          >
            <X size={24} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-180px)] p-6 space-y-6">
          {/* Conflicts Section */}
          {preview.conflicts.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="text-amber-600" size={20} />
                <h3 className="text-lg font-semibold text-slate-900">
                  Conflicts ({preview.conflicts.length})
                </h3>
              </div>
              <div className="space-y-3">
                {preview.conflicts.map((conflict, index) => (
                  <div
                    key={index}
                    className="p-4 bg-amber-50 rounded-lg border border-amber-200"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-semibold text-amber-900">
                        {conflict.section} - {conflict.field}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs font-medium text-slate-600 mb-1">
                          Existing (will be kept)
                        </p>
                        <p className="text-slate-900 bg-white p-2 rounded border border-amber-200">
                          {String(conflict.existingValue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-600 mb-1">
                          Imported (will be skipped)
                        </p>
                        <p className="text-slate-500 bg-white p-2 rounded border border-amber-200">
                          {String(conflict.importedValue)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* New Fields Section */}
          {preview.newFields.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="text-green-600" size={20} />
                <h3 className="text-lg font-semibold text-slate-900">
                  New Data to be Added
                </h3>
              </div>
              <div className="space-y-2">
                {preview.newFields.map((field, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200"
                  >
                    <CheckCircle className="text-green-600 flex-shrink-0" size={16} />
                    <span className="text-sm text-green-900">{field}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Preserved Fields Section */}
          {preview.preservedFields.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Info className="text-blue-600" size={20} />
                <h3 className="text-lg font-semibold text-slate-900">
                  Existing Data (Preserved)
                </h3>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900">
                  {preview.preservedFields.length} existing {preview.preservedFields.length === 1 ? 'field' : 'fields'} will be kept unchanged
                </p>
              </div>
            </section>
          )}

          {/* Summary */}
          {preview.newFields.length === 0 && preview.conflicts.length === 0 && (
            <div className="p-6 bg-slate-50 rounded-lg border border-slate-200 text-center">
              <Info className="text-slate-400 mx-auto mb-2" size={32} />
              <p className="text-slate-600">
                No new data to import. All fields already have values.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 flex gap-3">
          <button
            onClick={onCancel}
            className="
              flex-1 rounded-lg border-2 border-slate-300
              px-6 py-3 text-sm font-semibold text-slate-700
              transition-all duration-base
              hover:border-slate-400 hover:bg-white
              focus:outline-none focus:ring-2 focus:ring-slate-500/20
            "
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={preview.newFields.length === 0 && preview.conflicts.length === 0}
            className="
              flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600
              px-6 py-3 text-sm font-semibold text-white
              shadow-md shadow-indigo-200
              transition-all duration-base
              hover:shadow-lg hover:shadow-indigo-300 hover:from-blue-700 hover:to-indigo-700
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
              disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
            "
          >
            Import Data
          </button>
        </div>
      </div>
    </div>
  );
}
