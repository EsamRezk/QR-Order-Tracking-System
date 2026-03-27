import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

console.log('Connecting to Realtime on orders...')
const channel = supabase
  .channel('test_all_orders')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
    console.log('Realtime Event Received!', payload.eventType, payload.new?.id)
  })
  .subscribe((status) => {
    console.log('Subscription Status:', status)
  })
