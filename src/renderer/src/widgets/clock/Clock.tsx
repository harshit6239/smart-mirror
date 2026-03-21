function Clock(): React.JSX.Element {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  console.log('Current Time Zone:', timeZone)

  return (
    <>
      <div className="clock-widget">
        <h2>Clock Widget</h2>
        <p>Current Time Zone: {timeZone}</p>
      </div>
    </>
  )
}

export default Clock
