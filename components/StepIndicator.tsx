const steps = ['Datum & tijd', 'Groep', 'Gegevens']

export function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-6">
      {steps.map((label, i) => {
        const step = i + 1
        const isActive = step === currentStep
        const isDone = step < currentStep
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-md'
                    : isDone
                    ? 'bg-brand-100 text-brand-700'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {isDone ? '✓' : step}
              </div>
              <span
                className={`mt-1 text-xs font-medium hidden sm:block ${
                  isActive ? 'text-brand-700' : isDone ? 'text-brand-600' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-12 h-0.5 mx-1 mb-4 transition-all ${
                  step < currentStep ? 'bg-brand-600' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
