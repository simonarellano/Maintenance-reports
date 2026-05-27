// aeromx/backend/src/controllers/fallas/estadisticasController.js
import { calcularEstadisticas } from '../../services/fallasEstadisticasService.js'

export async function obtener(req, res, next) {
  try {
    const data = await calcularEstadisticas(req.query)
    res.json({ data })
  } catch (e) { next(e) }
}
