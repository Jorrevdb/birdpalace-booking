'use client'

interface CounterProps {
  value: number
  min?: number
  max?: number
  onChange: (val: number) => void
  label: string
  description?: string
}

export function Counter({ value, min = 0, max = 99, onChange, label, description }: CounterProps) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
      <div>
        <p className="font-medium text-gray-900">{label}</p>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="w-9 h-9 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-600 font-bold text-lg hover:border-brand-500 hover:text-brand-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          −
        </button>
        <span className="w-8 text-center font-semibold text-lg text-gray-900">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="w-9 h-9 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-600 font-bold text-lg hover:border-brand-500 hover:text-brand-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          +
        </button>
      </div>
    </div>
  )
}
