import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ═══════════════════════════════════════════════════════════════════
// يقرأ ويزامن إعداد "إظهار كل الطلبات على شاشة العرض" لفرع معيّن.
//   - شاشة الفرع (المطبخ سابقاً): تقرأ + تكتب القيمة عبر setShowAll.
//   - شاشة العرض: تقرأها فقط، وتتحدّث realtime فور تغييرها من أي جهاز.
// التخزين في جدول branch_settings (صف لكل فرع) + Supabase Realtime.
// ═══════════════════════════════════════════════════════════════════
export function useBranchDisplaySetting(branchId) {
  const [showAll, setShowAllState] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!branchId) return
    let active = true

    const fetchSetting = async () => {
      const { data } = await supabase
        .from('branch_settings')
        .select('show_all_on_display')
        .eq('branch_id', branchId)
        .maybeSingle()
      if (!active) return
      setShowAllState(data?.show_all_on_display ?? false)
      setLoading(false)
    }
    fetchSetting()

    const channel = supabase
      .channel(`branch_settings-${branchId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'branch_settings', filter: `branch_id=eq.${branchId}` },
        (payload) => {
          if (payload.new) setShowAllState(payload.new.show_all_on_display)
        }
      )
      .subscribe()

    return () => { active = false; supabase.removeChannel(channel) }
  }, [branchId])

  // كتابة القيمة (upsert) — تُستدعى من شاشة الفرع
  const setShowAll = useCallback(async (value) => {
    if (!branchId) return
    setShowAllState(value) // تحديث تفاؤلي فوري
    const { error } = await supabase
      .from('branch_settings')
      .upsert(
        { branch_id: branchId, show_all_on_display: value, updated_at: new Date().toISOString() },
        { onConflict: 'branch_id' },
      )
    if (error) console.error('فشل حفظ إعداد شاشة العرض:', error)
  }, [branchId])

  return { showAll, setShowAll, loading }
}
