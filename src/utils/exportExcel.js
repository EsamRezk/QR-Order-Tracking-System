import ExcelJS from 'exceljs'
import { resolveDeliveryApp, resolveAppOrderNumber, resolveFoodicsNumber } from '../config/deliveryApps'

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

const STATUS_LABELS = {
  new: 'جديد',
  preparing: 'قيد التحضير',
  ready: 'جاهز',
  completed: 'مكتمل',
  cancelled: 'ملغي',
}

// نص مصدر تغيير الحالة لكل انتقال (النظام/فوديكس) — يطابق عمود "مصدر التحديث" في الواجهة
function getSourceText(order, sources) {
  if (order.status !== 'ready' && order.status !== 'completed') return '—'
  const src = sources?.[order.id] || {}
  const lines = [`جاهز: ${src.ready ? 'النظام' : 'فوديكس'}`]
  if (order.status === 'completed') {
    lines.push(`تسليم: ${src.delivered ? 'النظام' : 'فوديكس'}`)
  }
  return lines.join('\n')
}

function formatPrepDuration(seconds) {
  if (!seconds) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins === 0) return `${secs} ث`
  return `${mins}د ${secs}ث`
}

export async function exportOrdersToExcel(orders, branchName, sources = {}) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'كبة زون'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('سجل الطلبات', {
    views: [{ rightToLeft: true }],
  })

  // Column definitions
  sheet.columns = [
    { header: 'التطبيق', key: 'app', width: 16 },
    { header: 'رقم بالتطبيق', key: 'app_number', width: 18 },
    { header: 'رقم فوديكس', key: 'foodics_number', width: 16 },
    { header: 'الفرع', key: 'branch', width: 16 },
    { header: 'الحالة', key: 'status', width: 14 },
    { header: 'مصدر التحديث', key: 'source', width: 20 },
    { header: 'وقت الطلب', key: 'order_time', width: 26 },
    { header: 'وقت الجاهزية', key: 'ready_at', width: 26 },
    { header: 'مدة التحضير', key: 'prep_duration', width: 16 },
  ]

  // ── Row 1-2: Logo + Title ──
  // Merge cells for logo area
  sheet.mergeCells('A1:I2')
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
      tl: { col: 7, row: 0.1 },
      ext: { width: 80, height: 45 },
    })
  }

  // ── Row 3: Header ──
  const headerRow = sheet.getRow(3)
  const headers = ['التطبيق', 'رقم بالتطبيق', 'رقم فوديكس', 'الفرع', 'الحالة', 'مصدر التحديث', 'وقت الطلب', 'وقت الجاهزية', 'مدة التحضير']
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = h
    cell.font = { name: 'Tajawal', size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF440099' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF330077' } },
      bottom: { style: 'thin', color: { argb: 'FF330077' } },
      left: { style: 'thin', color: { argb: 'FF330077' } },
      right: { style: 'thin', color: { argb: 'FF330077' } },
    }
  })
  headerRow.height = 32

  // ── Data Rows (starting from row 4) ──
  orders.forEach((order, index) => {
    const rowNum = index + 4
    const row = sheet.getRow(rowNum)
    const isEven = index % 2 === 0
    const bgColor = isEven ? 'FFFFFFFF' : 'FFF5F2FA'

    const orderTime = order.scanned_at || order.created_at
    const values = [
      resolveDeliveryApp(order).name,
      resolveAppOrderNumber(order) || '—',
      resolveFoodicsNumber(order),
      order.branches?.name_ar || '—',
      STATUS_LABELS[order.status] || order.status,
      getSourceText(order, sources),
      orderTime ? new Date(orderTime).toLocaleString('ar-SA') : '—',
      order.ready_at ? new Date(order.ready_at).toLocaleString('ar-SA') : '—',
      formatPrepDuration(order.prep_duration_seconds),
    ]

    values.forEach((val, i) => {
      const cell = row.getCell(i + 1)
      cell.value = val
      cell.font = { name: 'Tajawal', size: 11, color: { argb: 'FF333333' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl', wrapText: true }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      }
    })
    row.height = order.status === 'completed' ? 40 : 26
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
