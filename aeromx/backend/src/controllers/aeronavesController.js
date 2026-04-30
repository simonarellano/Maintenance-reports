import * as svc from '../services/aeronavesService.js'

export async function listar(req, res) {
  const todas = req.query.todas === 'true'
  const aeronaves = await svc.listarAeronaves(!todas)
  res.json(aeronaves)
}

export async function obtener(req, res) {
  const aeronave = await svc.obtenerAeronave(req.params.id)
  if (!aeronave) return res.status(404).json({ error: 'Aeronave no encontrada' })
  res.json(aeronave)
}

export async function crear(req, res, next) {
  const {
    modeloId, matricula, numeroSerie, horasTotales,
    horasMotorDer, horasMotorIzq,
    horasMotorDel, horasMotorTras,
  } = req.body
  if (!modeloId || !matricula) {
    return res.status(400).json({ error: 'modeloId y matricula son requeridos' })
  }

  try {
    const aeronave = await svc.crearAeronave({
      modeloId,
      matricula: matricula.toUpperCase(),
      numeroSerie,
      horasTotales: horasTotales ?? 0,
      horasMotorDer: horasMotorDer ?? horasMotorDel ?? 0,
      horasMotorIzq: horasMotorIzq ?? horasMotorTras ?? 0,
    })
    res.status(201).json(aeronave)
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Ya existe una aeronave con esa matrícula' })
    if (e.code === 'P2003') return res.status(400).json({ error: 'El modelo indicado no existe' })
    next(e)
  }
}

export async function actualizar(req, res, next) {
  const {
    modeloId, matricula, numeroSerie, horasTotales,
    horasMotorDer, horasMotorIzq,
    horasMotorDel, horasMotorTras,
  } = req.body
  const data = {}
  if (modeloId !== undefined) data.modeloId = modeloId
  if (matricula !== undefined) data.matricula = matricula.toUpperCase()
  if (numeroSerie !== undefined) data.numeroSerie = numeroSerie
  if (horasTotales !== undefined) data.horasTotales = horasTotales
  if (horasMotorDer !== undefined) data.horasMotorDer = horasMotorDer
  if (horasMotorIzq !== undefined) data.horasMotorIzq = horasMotorIzq
  if (horasMotorDel !== undefined) data.horasMotorDer = horasMotorDel
  if (horasMotorTras !== undefined) data.horasMotorIzq = horasMotorTras

  try {
    const aeronave = await svc.actualizarAeronave(req.params.id, data)
    res.json(aeronave)
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Aeronave no encontrada' })
    if (e.code === 'P2002') return res.status(409).json({ error: 'Ya existe una aeronave con esa matrícula' })
    next(e)
  }
}

export async function desactivar(req, res, next) {
  try {
    await svc.desactivarAeronave(req.params.id)
    res.status(204).send()
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Aeronave no encontrada' })
    next(e)
  }
}
