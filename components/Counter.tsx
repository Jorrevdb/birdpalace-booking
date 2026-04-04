export function Counter({ value, onChange, label }: { value: number; min?: number; max?: number; onChange: (v: number) => void; label: string; description?: string }) {
  return <div>{label}: <button onClick={() => onChange(value - 1)}>-</button>{value}<button onClick={() => onChange(value + 1)}>+</button></div>
}
