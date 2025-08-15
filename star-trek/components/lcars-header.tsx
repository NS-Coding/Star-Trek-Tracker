interface LcarsHeaderProps {
  title: string
}

export function LcarsHeader({ title }: LcarsHeaderProps) {
  return (
    <header className="lcars-header">
      <h1 className="text-2xl font-bold ml-8">{title}</h1>
    </header>
  )
}
