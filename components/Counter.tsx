interface CounterProps {
  label: string
  description?: string
  value: number
  min?: number
  max?: number
  onChange: (v: number) => void
}

export function Counter({ label, description, value, min = 0, max = 99, onChange }: CounterProps) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="w-9 h-9 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-600 font-semibold text-lg hover:border-brand-600 hover:text-brand-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          −
        </button>
        <span className="w-6 text-center text-base font-semibold text-gray-900">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="w-9 h-9 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-600 font-semibold text-lg hover:border-brand-600 hover:text-brand-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          +
        </button>
      </div>
    </div>
  )
}
