import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

export default function ScannerView({ onScan, enabled = true }) {
  const scannerRef = useRef(null)
  const html5QrRef = useRef(null)

  useEffect(() => {
    if (!enabled) return

    const scanner = new Html5Qrcode('qr-reader')
    html5QrRef.current = scanner

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        onScan(decodedText)
      },
      () => {}
    ).catch((err) => {
      console.error('Camera error:', err)
    })

    return () => {
      scanner.stop().catch(() => {})
    }
  }, [enabled, onScan])

  return (
    <div className="relative mx-auto w-72 h-72 sm:w-80 sm:h-80">
      <div id="qr-reader" ref={scannerRef} className="w-full h-full overflow-hidden rounded-lg border-2 border-[#FF5100]/20" />
      {/* Corner brackets */}
      <div className="absolute top-0 right-0 w-10 h-10 border-t-[3px] border-r-[3px] border-[#FF5100] rounded-tr-md" />
      <div className="absolute top-0 left-0 w-10 h-10 border-t-[3px] border-l-[3px] border-[#FF5100] rounded-tl-md" />
      <div className="absolute bottom-0 right-0 w-10 h-10 border-b-[3px] border-r-[3px] border-[#FF5100] rounded-br-md" />
      <div className="absolute bottom-0 left-0 w-10 h-10 border-b-[3px] border-l-[3px] border-[#FF5100] rounded-bl-md" />
      {/* Scan line */}
      <div className="absolute right-3 left-3 h-0.5 bg-gradient-to-r from-transparent via-[#FF5100] to-transparent opacity-80 animate-scan-line" />
    </div>
  )
}
