import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// Hook generico de leitura/escrita para as tabelas sgsi_*
export function useTable(tabela, { select = '*', order = { column: 'criado_em', ascending: false } } = {}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from(tabela).select(select)
    if (order) q = q.order(order.column, { ascending: order.ascending })
    const { data, error } = await q
    if (error) setErro(error.message)
    setRows(data || [])
    setLoading(false)
  }, [tabela, select, order?.column, order?.ascending])

  useEffect(() => { fetch() }, [fetch])

  const insert = async (payload) => {
    const { data, error } = await supabase.from(tabela).insert(payload).select().single()
    if (!error) await fetch()
    return { data, error }
  }
  const update = async (id, payload) => {
    const { data, error } = await supabase.from(tabela).update(payload).eq('id', id).select().single()
    if (!error) await fetch()
    return { data, error }
  }
  const remove = async (id) => {
    const { error } = await supabase.from(tabela).delete().eq('id', id)
    if (!error) await fetch()
    return { error }
  }

  return { rows, loading, erro, refetch: fetch, insert, update, remove }
}
