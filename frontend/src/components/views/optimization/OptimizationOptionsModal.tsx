import { useState, useEffect } from 'react';
import { X, Settings, AlertCircle, Info } from 'lucide-react';
import { 
  OptimizationOptions, 
  DEFAULT_OPTIMIZATION_OPTIONS, 
  validateOptimizationOptions 
} from '../../../lib/optimization/types';

interface OptimizationOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: OptimizationOptions;
  onSave: (savedOptions: OptimizationOptions) => void;
}

interface FormState {
  randomStartingPoints: string;
  numberDesignPoints: string;
  duplicateFilter: string;
  simplexFraction: string;
  maxSolutions: string;
  includeStdError: boolean;
}

function formatOptionsToForm(opts: OptimizationOptions): FormState {
  return {
    randomStartingPoints: opts.randomStartingPoints !== undefined && !isNaN(opts.randomStartingPoints) ? String(opts.randomStartingPoints) : '100',
    numberDesignPoints: opts.numberDesignPoints !== undefined && !isNaN(opts.numberDesignPoints) ? String(opts.numberDesignPoints) : '50',
    duplicateFilter: opts.duplicateFilter !== undefined && !isNaN(opts.duplicateFilter) ? String(opts.duplicateFilter) : '0.5',
    simplexFraction: opts.simplexFraction !== undefined && !isNaN(opts.simplexFraction) ? String(opts.simplexFraction) : '0.1',
    maxSolutions: opts.maxSolutions !== undefined && !isNaN(opts.maxSolutions) ? String(opts.maxSolutions) : '100',
    includeStdError: Boolean(opts.includeStdError),
  };
}

export function OptimizationOptionsModal({
  isOpen,
  onClose,
  options,
  onSave,
}: OptimizationOptionsModalProps) {
  const [formData, setFormData] = useState<FormState>(() => formatOptionsToForm(options));
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form data to current options whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(formatOptionsToForm(options));
      setErrors({});
    }
  }, [isOpen, options]);

  if (!isOpen) return null;

  const handleChange = (field: keyof FormState, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleResetDefaults = () => {
    setFormData(formatOptionsToForm(DEFAULT_OPTIMIZATION_OPTIONS));
    setErrors({});
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    // Parse values from string to numeric types
    const parsedOptions: OptimizationOptions = {
      randomStartingPoints: formData.randomStartingPoints.trim() === '' ? NaN : Number(formData.randomStartingPoints),
      numberDesignPoints: formData.numberDesignPoints.trim() === '' ? NaN : Number(formData.numberDesignPoints),
      duplicateFilter: formData.duplicateFilter.trim() === '' ? NaN : Number(formData.duplicateFilter),
      simplexFraction: formData.simplexFraction.trim() === '' ? NaN : Number(formData.simplexFraction),
      maxSolutions: formData.maxSolutions.trim() === '' ? NaN : Number(formData.maxSolutions),
      includeStdError: formData.includeStdError,
    };

    const validationErrors = validateOptimizationOptions(parsedOptions);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    onSave(parsedOptions);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[0.5px]">
      <div 
        className="bg-[#FAFAFA] border border-[#909090] shadow-2xl rounded-sm w-[460px] flex flex-col font-sans text-xs select-none animate-in fade-in zoom-in-95 duration-100"
        role="dialog"
        aria-labelledby="options-dialog-title"
      >
        {/* Title Bar */}
        <div className="bg-[#003366] text-white px-3 py-2 flex justify-between items-center font-bold tracking-wide">
          <div className="flex items-center gap-2">
            <Settings size={14} className="text-[#A0C4FF]" />
            <span id="options-dialog-title">Numerical Optimization Options</span>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="hover:bg-[#002244] p-0.5 rounded text-white/80 hover:text-white transition-colors"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Form Body */}
        <form noValidate onSubmit={handleSave}>
          <div className="p-4 space-y-3.5 bg-white border-b border-[#D0D0D0]">
            
            {/* Random starting points */}
            <div className="flex items-center justify-between gap-4">
              <label className="text-gray-800 font-semibold" htmlFor="opt-random-points">
                Random starting points:
              </label>
              <div className="w-32">
                <input
                  id="opt-random-points"
                  type="number"
                  min="0"
                  step="1"
                  className={`w-full border px-2 py-1 text-right font-mono text-gray-900 focus:outline-none focus:border-[#0055A4] ${
                    errors.randomStartingPoints ? 'border-red-500 bg-red-50' : 'border-[#909090] bg-white'
                  }`}
                  value={formData.randomStartingPoints}
                  onChange={e => handleChange('randomStartingPoints', e.target.value)}
                />
              </div>
            </div>
            {errors.randomStartingPoints && (
              <p className="text-[10px] text-red-600 flex items-center gap-1 justify-end">
                <AlertCircle size={11} /> {errors.randomStartingPoints}
              </p>
            )}

            {/* Number of design points */}
            <div className="flex items-center justify-between gap-4">
              <label className="text-gray-800 font-semibold" htmlFor="opt-design-points">
                Number of design points:
              </label>
              <div className="w-32">
                <input
                  id="opt-design-points"
                  type="number"
                  min="0"
                  step="1"
                  className={`w-full border px-2 py-1 text-right font-mono text-gray-900 focus:outline-none focus:border-[#0055A4] ${
                    errors.numberDesignPoints ? 'border-red-500 bg-red-50' : 'border-[#909090] bg-white'
                  }`}
                  value={formData.numberDesignPoints}
                  onChange={e => handleChange('numberDesignPoints', e.target.value)}
                />
              </div>
            </div>
            {errors.numberDesignPoints && (
              <p className="text-[10px] text-red-600 flex items-center gap-1 justify-end">
                <AlertCircle size={11} /> {errors.numberDesignPoints}
              </p>
            )}

            {/* Duplicate solution filter */}
            <div className="flex items-center justify-between gap-4">
              <label className="text-gray-800 font-semibold" htmlFor="opt-dup-filter">
                Duplicate solution filter:
              </label>
              <div className="w-32">
                <input
                  id="opt-dup-filter"
                  type="number"
                  step="any"
                  min="0"
                  className={`w-full border px-2 py-1 text-right font-mono text-gray-900 focus:outline-none focus:border-[#0055A4] ${
                    errors.duplicateFilter ? 'border-red-500 bg-red-50' : 'border-[#909090] bg-white'
                  }`}
                  value={formData.duplicateFilter}
                  onChange={e => handleChange('duplicateFilter', e.target.value)}
                />
              </div>
            </div>
            {errors.duplicateFilter && (
              <p className="text-[10px] text-red-600 flex items-center gap-1 justify-end">
                <AlertCircle size={11} /> {errors.duplicateFilter}
              </p>
            )}

            {/* Simplex fraction */}
            <div className="flex items-center justify-between gap-4">
              <label className="text-gray-800 font-semibold" htmlFor="opt-simplex">
                Simplex fraction:
              </label>
              <div className="w-32">
                <input
                  id="opt-simplex"
                  type="number"
                  step="any"
                  min="0"
                  max="1.0"
                  className={`w-full border px-2 py-1 text-right font-mono text-gray-900 focus:outline-none focus:border-[#0055A4] ${
                    errors.simplexFraction ? 'border-red-500 bg-red-50' : 'border-[#909090] bg-white'
                  }`}
                  value={formData.simplexFraction}
                  onChange={e => handleChange('simplexFraction', e.target.value)}
                />
              </div>
            </div>
            {errors.simplexFraction && (
              <p className="text-[10px] text-red-600 flex items-center gap-1 justify-end">
                <AlertCircle size={11} /> {errors.simplexFraction}
              </p>
            )}

            {/* Maximum number of solutions */}
            <div className="flex items-center justify-between gap-4">
              <label className="text-gray-800 font-semibold" htmlFor="opt-max-sols">
                Maximum number of solutions:
              </label>
              <div className="w-32">
                <input
                  id="opt-max-sols"
                  type="number"
                  min="1"
                  step="1"
                  className={`w-full border px-2 py-1 text-right font-mono text-gray-900 focus:outline-none focus:border-[#0055A4] ${
                    errors.maxSolutions ? 'border-red-500 bg-red-50' : 'border-[#909090] bg-white'
                  }`}
                  value={formData.maxSolutions}
                  onChange={e => handleChange('maxSolutions', e.target.value)}
                />
              </div>
            </div>
            {errors.maxSolutions && (
              <p className="text-[10px] text-red-600 flex items-center gap-1 justify-end">
                <AlertCircle size={11} /> {errors.maxSolutions}
              </p>
            )}

            {/* Include std error models */}
            <div className="pt-2 border-t border-[#EAEAEA]">
              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-gray-400 text-[#0055A4] focus:ring-0"
                  checked={formData.includeStdError}
                  onChange={e => handleChange('includeStdError', e.target.checked)}
                />
                <span className="font-semibold text-gray-800">Include std error models</span>
              </label>

              <div className="mt-2 bg-[#FFF8E6] border border-[#F2D675] p-2 rounded-sm text-[11px] text-[#7A5B00] flex items-start gap-1.5">
                <Info size={13} className="shrink-0 mt-0.5 text-[#D5AC2C]" />
                <span>
                  <strong>Note:</strong> Standard-error model propagation is preserved as a configuration setting, but is not yet active in the current optimization solver.
                </span>
              </div>
            </div>

          </div>

          {/* Dialog Action Buttons */}
          <div className="bg-[#EFEFEF] px-4 py-2.5 flex justify-between items-center border-t border-white">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3 py-1 bg-white hover:bg-[#E5E5E5] text-gray-700 font-semibold border border-[#B0B0B0] rounded-sm shadow-xs transition-colors"
            >
              Defaults
            </button>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-1 bg-[#0055A4] hover:bg-[#003366] text-white font-bold rounded-sm shadow-sm transition-colors"
              >
                OK
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1 bg-white hover:bg-[#E5E5E5] text-gray-700 font-semibold border border-[#B0B0B0] rounded-sm shadow-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
}
