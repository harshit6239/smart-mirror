type PageDotsProps = {
  count: number
  active: number
}

export default function PageDots({ count, active }: PageDotsProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={[
            'rounded-full transition-all duration-300',
            i === active ? 'h-2 w-6 bg-white' : 'h-2 w-2 bg-white/30'
          ].join(' ')}
        />
      ))}
    </div>
  )
}
