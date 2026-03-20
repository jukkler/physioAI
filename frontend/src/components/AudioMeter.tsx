interface AudioMeterProps {
  level: number // 0-1
}

export function AudioMeter({ level }: AudioMeterProps) {
  const bars = 20
  const activeBars = Math.round(level * bars)

  return (
    <div className="flex items-end gap-0.5 h-8">
      {Array.from({ length: bars }, (_, i) => (
        <div
          key={i}
          className={`w-1.5 rounded-sm transition-all duration-75 ${
            i < activeBars ? 'bg-green-500' : 'bg-gray-200'
          }`}
          style={{ height: `${((i + 1) / bars) * 100}%` }}
        />
      ))}
    </div>
  )
}
