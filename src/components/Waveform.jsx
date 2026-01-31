import { useEffect, useRef, memo } from 'react'

/**
 * Live Waveform - Full width, prominent
 */
export const Waveform = memo(({ 
  isRecording, 
  analyserNode,
  barCount = 48,
  color = '#1c4668'
}) => {
  const barsRef = useRef([])
  const animationRef = useRef(null)

  useEffect(() => {
    if (!isRecording) {
      barsRef.current.forEach(bar => {
        if (bar) bar.style.transform = 'scaleY(0.15)'
      })
      return
    }

    if (!analyserNode) {
      let time = 0
      const simulate = () => {
        time += 0.12
        barsRef.current.forEach((bar, i) => {
          if (!bar) return
          const wave = Math.sin(time + i * 0.15) * 0.35 + 0.5
          const noise = Math.random() * 0.25
          bar.style.transform = `scaleY(${Math.max(0.15, wave + noise)})`
        })
        animationRef.current = requestAnimationFrame(simulate)
      }
      simulate()
      return () => cancelAnimationFrame(animationRef.current)
    }

    const dataArray = new Uint8Array(analyserNode.frequencyBinCount)
    const step = Math.floor(dataArray.length / barCount)
    
    const draw = () => {
      analyserNode.getByteFrequencyData(dataArray)
      
      barsRef.current.forEach((bar, i) => {
        if (!bar) return
        const start = i * step
        let sum = 0
        for (let j = start; j < start + step; j++) {
          sum += dataArray[j] || 0
        }
        const avg = sum / step / 255
        bar.style.transform = `scaleY(${Math.max(0.15, avg)})`
      })
      
      animationRef.current = requestAnimationFrame(draw)
    }
    
    draw()
    return () => cancelAnimationFrame(animationRef.current)
  }, [isRecording, analyserNode, barCount])

  return (
    <div className="w-full flex items-center justify-center gap-[3px] h-full">
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          ref={el => barsRef.current[i] = el}
          className="flex-1 max-w-[6px] h-full rounded-full origin-center"
          style={{
            backgroundColor: isRecording ? '#ef4444' : color,
            opacity: isRecording ? 0.85 : 0.25,
            transform: 'scaleY(0.15)',
            transition: 'opacity 200ms',
          }}
        />
      ))}
    </div>
  )
})

Waveform.displayName = 'Waveform'

/**
 * Static Waveform - Refined, Jony Ive inspired
 * Delicate, subtle, full-width visualization
 */
export const StaticWaveform = memo(({ 
  barCount = 100,
  height = 48,
  activeColor = '#94a3b8',
  inactiveColor = '#d1d5db',
  progress = 0
}) => {
  const activeIndex = Math.floor(progress * barCount)

  // Generate consistent random heights using index as seed
  const getHeight = (i) => {
    const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453
    return (x - Math.floor(x)) * 0.6 + 0.25
  }

  return (
    <div 
      className="w-full h-full flex items-center justify-between"
      style={{ height }}
    >
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          className="rounded-sm"
          style={{
            width: '0.6%',
            height: `${getHeight(i) * 100}%`,
            backgroundColor: i < activeIndex ? activeColor : inactiveColor,
            minHeight: 2,
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  )
})

StaticWaveform.displayName = 'StaticWaveform'
