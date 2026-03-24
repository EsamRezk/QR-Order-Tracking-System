import { useRef, useCallback } from 'react'

export function useSound(src = '/notification.mp3') {
  const audioContextRef = useRef(null)
  const bufferRef = useRef(null)
  const loadedRef = useRef(false)

  const loadSound = useCallback(async () => {
    if (loadedRef.current) return
    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      const response = await fetch(src)
      const arrayBuffer = await response.arrayBuffer()
      bufferRef.current = await audioContextRef.current.decodeAudioData(arrayBuffer)
      loadedRef.current = true
    } catch (err) {
      console.warn('Could not load notification sound:', err)
    }
  }, [src])

  const play = useCallback(async () => {
    if (!loadedRef.current) await loadSound()
    if (!audioContextRef.current || !bufferRef.current) return

    try {
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume()
      }
      const source = audioContextRef.current.createBufferSource()
      source.buffer = bufferRef.current
      source.connect(audioContextRef.current.destination)
      source.start(0)
    } catch (err) {
      console.warn('Could not play notification:', err)
    }
  }, [loadSound])

  return { play, loadSound }
}
