import ExcelJS from 'exceljs'

// Convert image file to base64 for exceljs
async function getLogoBase64() {
  try {
    const response = await fetch('/assets/img/KebbaZone Logo.png')
    const blob = await response.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result.split(',')[1])
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function getChannelName(channelLink) {
  if (!channelLink) return 'مباشر'
  if (channelLink.includes('jahez')) return 'جاهز'
  if (channelLink.includes('hungerstation')) return 'هنقرستيشن'
  return 'توصيل'
}

function formatPrepDuration(seconds) {
  if (!seconds) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins === 0) return `${secs} ث`
  return `${mins}د ${secs}ث`
}

export async function exportOrdersToExcel(orders, branchName) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'كبة زون'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('سجل الطلبات', {
    views: [{ rightToLeft: true }],
  })

  // Column definitions
  sheet.columns = [
    { header: 'رقم الطلب', key: 'order_id', width: 18 },
    { header: 'الفرع', key: 'branch', width: 16 },
    { header: 'القناة', key: 'channel', width: 16 },
    { header: 'وقت المسح', key: 'scanned_at', width: 28 },
    { header: 'وقت الجاهزية', key: 'ready_at', width: 28 },
    { header: 'مدة التحضير', key: 'prep_duration', width: 18 },
  ]

  // ── Row 1-2: Logo + Title ──
  // Merge cells for logo area
  sheet.mergeCells('A1:F2')
  const titleCell = sheet.getCell('A1')
  titleCell.value = `سجل الطلبات — ${branchName || 'جميع الفروع'}`
  titleCell.font = { name: 'Tajawal', size: 16, bold: true, color: { argb: 'FF333333' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F5F4' } }

  // Set title rows height
  sheet.getRow(1).height = 20
  sheet.getRow(2).height = 20

  // Try to add logo
  const logoBase64 = await getLogoBase64()
  if (logoBase64) {
    const logoId = workbook.addImage({
      base64: logoBase64,
      extension: 'png',
    })
    sheet.addImage(logoId, {
      tl: { col: 4.5, row: 0.1 },
      ext: { width: 80, height: 45 },
    })
  }

  // ── Row 3: Header ──
  const headerRow = sheet.getRow(3)
  const headers = ['رقم الطلب', 'الفرع', 'القناة', 'وقت المسح', 'وقت الجاهزية', 'مدة التحضير']
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = h
    cell.font = { name: 'Tajawal', size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF5100' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE04500' } },
      bottom: { style: 'thin', color: { argb: 'FFE04500' } },
      left: { style: 'thin', color: { argb: 'FFE04500' } },
      right: { style: 'thin', color: { argb: 'FFE04500' } },
    }
  })
  headerRow.height = 32

  // ── Data Rows (starting from row 4) ──
  orders.forEach((order, index) => {
    const rowNum = index + 4
    const row = sheet.getRow(rowNum)
    const isEven = index % 2 === 0
    const bgColor = isEven ? 'FFFFFFFF' : 'FFFFF5F0'

    const values = [
      order.order_id,
      order.branches?.name_ar || '—',
      getChannelName(order.channel_link),
      order.scanned_at ? new Date(order.scanned_at).toLocaleString('ar-SA') : '—',
      order.ready_at ? new Date(order.ready_at).toLocaleString('ar-SA') : '—',
      formatPrepDuration(order.prep_duration_seconds),
    ]

    values.forEach((val, i) => {
      const cell = row.getCell(i + 1)
      cell.value = val
      cell.font = { name: 'Tajawal', size: 11, color: { argb: 'FF333333' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      }
    })
    row.height = 26
  })

  // ── Generate & Download ──
  const today = new Date().toISOString().slice(0, 10)
  const fileName = `طلبات_${branchName || 'الكل'}_${today}.xlsx`

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
