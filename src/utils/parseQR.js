export function parseQR(rawText) {
  try {
    const data = JSON.parse(rawText)
    if (!data.order_id) throw new Error('Missing order_id')
    return {
      order_id: data.order_id,
      channel_link: data.channel_link || null,
      location: data.location || null,
      raw: data,
    }
  } catch {
    return {
      order_id: rawText.trim(),
      channel_link: null,
      location: null,
      raw: { order_id: rawText.trim() },
    }
  }
}
