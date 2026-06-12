async function confirmarReserva() {
  if (!rifa) {
    setAlerta({
      tipo: 'err',
      msg: 'Rifa não configurada.'
    })
    return
  }

  setEnviando(true)

  const { error } = await supabase.from('reservas').insert(
    selecionados.map(numero => ({
      rifa_id: rifa.id,
      numero,
      nome: nome.trim(),
      telefone: telefone.trim(),
      status: 'reservado'
    }))
  )

  setEnviando(false)

  if (error) {
    setModalOpen(false)
    setAlerta({
      tipo: 'err',
      msg: 'Erro ao reservar. Alguns números podem ter sido tomados.'
    })
    return
  }

  setModalOpen(false)
  setSelecionados([])
  setNome('')
  setTelefone('')
  setAlerta({
    tipo: 'ok',
    msg: 'Reserva feita! Efetue o pagamento via Pix para confirmar.'
  })

  setTimeout(() => setAlerta(null), 6000)
}
