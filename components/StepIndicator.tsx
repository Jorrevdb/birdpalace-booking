'use client'

interface Step {
  number: number
  label: string
}

const STEPS: Step[] = [
  { number: 1, label: 'Datum & tijd' },
  { number: 2, label: 'Groep' },
  { number: 3, label: 'Jouw gegevens' },
]

export function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((step, i) => (
        <div key={step.number} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                step.number < currentStep
                  ? 'bg-brand-600 text-white'
                  : step.number === currentStep
                  ? 'bg-brand-600 text-white ring-4 ring-brand-100'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {step.number < currentStep ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                step.number
              )}
            </div>
            <span
              className={`text-xs mt-1 whitespace-nowrap ${
                step.number === currentStep ? 'text-brand-700 font-medium' : 'text-gray-400'
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`w-16 h-0.5 mb-5 mx-1 transition-all ${
                step.number < currentStep ? 'bg-brand-600' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}
