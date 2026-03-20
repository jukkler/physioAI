import { useState, useEffect, useRef } from 'react'

export function useAudioMeter(stream: MediaStream | null): number {
  const [level, setLevel] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!stream) {
      setLevel(0)
      return
    }

    const audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)

    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    function update() {
      analyser.getByteFrequencyData(dataArray)
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
      setLevel(average / 255)
      rafRef.current = requestAnimationFrame(update)
    }
    update()

    return () => {
      cancelAnimationFrame(rafRef.current)
      source.disconnect()
      audioContext.close()
    }
  }, [stream])

  return level
}
