import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ═══════════════════════════════════════════════════════════════════
// يقرأ ويزامن إعداد "إظهار كل الطلبات على شاشة العرض" لفرع معيّن.
//   - شاشة الفرع (المطبخ سابقاً): تقرأ + تكتب القيمة عبر setShowAll.
//   - شاشة العرض: تقرأها فقط، وتتحدّث realtime فور تغييرها من أي جهاز.
// التخزين في جدول branch_settings (صف لكل فرع) + Supabase Realtime.
// ═══════════════════════════════════════════════════════════════════
export function useBranchDisplaySetting(branchId, initialSetting) {
  const [showAll, setShowAllState] = useState(() => initialSetting?.show_all_on_display ?? false)
  // وضع عرض الطلبات على شاشة العرض: 'all' | 'ready' | 'preparing' | 'split'
  const [displayMode, setDisplayModeState] = useState(() => initialSetting?.display_mode ?? 'all')
  // إظهار/إخفاء هيدر شاشة العرض (يُضبط من شاشة الفرع)
  const [showHeader, setShowHeaderState] = useState(() => initialSetting?.show_header ?? true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!branchId) return
    let active = true

    // لو وصل إعداد أولي جاهز (من bootstrap شاشة الفرع/العرض) نستخدمه مباشرة
    // بدل رحلة جلب إضافية مكرّرة — راجع rpc_branch_bootstrap.
    if (initialSetting) {
      setShowAllState(initialSetting.show_all_on_display ?? false)
      setDisplayModeState(initialSetting.display_mode ?? 'all')
      setShowHeaderState(initialSetting.show_header ?? true)
      setLoading(false)
    } else {
      const fetchSetting = async () => {
        const { data } = await supabase
          .from('branch_settings')
          .select('show_all_on_display, display_mode, show_header')
          .eq('branch_id', branchId)
          .maybeSingle()
        if (!active) return
        setShowAllState(data?.show_all_on_display ?? false)
        setDisplayModeState(data?.display_mode ?? 'all')
        setShowHeaderState(data?.show_header ?? true)
        setLoading(false)
      }
      fetchSetting()
    }

    const channel = supabase
      .channel(`branch_settings-${branchId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'branch_settings', filter: `branch_id=eq.${branchId}` },
        (payload) => {
          if (payload.new) {
            setShowAllState(payload.new.show_all_on_display)
            setDisplayModeState(payload.new.display_mode ?? 'all')
            setShowHeaderState(payload.new.show_header ?? true)
          }
        }
      )
      .subscribe()

    return () => { active = false; supabase.removeChannel(channel) }
    // initialSetting مقصود خارج الاعتماديات: يُستخدم كبذرة مرة واحدة عند تغيّر
    // branchId نفسه (يصل من نفس bootstrap)، لا كسبب لإعادة تنفيذ الـ effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // كتابة وضع العرض (upsert) — تُستدعى من شاشة الفرع، تتزامن مع شاشة العرض
  const setDisplayMode = useCallback(async (value) => {
    if (!branchId) return
    setDisplayModeState(value) // تحديث تفاؤلي فوري
    const { error } = await supabase
      .from('branch_settings')
      .upsert(
        { branch_id: branchId, display_mode: value, updated_at: new Date().toISOString() },
        { onConflict: 'branch_id' },
      )
    if (error) console.error('فشل حفظ وضع شاشة العرض:', error)
  }, [branchId])

  // كتابة إظهار/إخفاء الهيدر (upsert) — تُستدعى من شاشة الفرع، تتزامن مع شاشة العرض
  const setShowHeader = useCallback(async (value) => {
    if (!branchId) return
    setShowHeaderState(value) // تحديث تفاؤلي فوري
    const { error } = await supabase
      .from('branch_settings')
      .upsert(
        { branch_id: branchId, show_header: value, updated_at: new Date().toISOString() },
        { onConflict: 'branch_id' },
      )
    if (error) console.error('فشل حفظ إعداد هيدر شاشة العرض:', error)
  }, [branchId])

  return { showAll, setShowAll, displayMode, setDisplayMode, showHeader, setShowHeader, loading }
}
