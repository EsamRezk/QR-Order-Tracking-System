import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import './ScannerView.css'

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
      () => { }
    ).catch((err) => {
      console.error('Camera error:', err)
    })

    return () => {
      scanner.stop().catch(() => { })
    }
  }, [enabled, onScan])

  return (
    <div className="scanner-view-container">
      <div id="qr-reader" ref={scannerRef} className="scanner-view-reader" />

      {/* Corner brackets */}
      <span className="scanner-corner scanner-corner--tr" />
      <span className="scanner-corner scanner-corner--tl" />
      <span className="scanner-corner scanner-corner--br" />
      <span className="scanner-corner scanner-corner--bl" />

      {/* Scan line */}
      <div className="scanner-scan-line" />
    </div>
  )
}