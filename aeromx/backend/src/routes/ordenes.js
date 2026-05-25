import { Router } from 'express'
import { verifyToken, requireRole } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'
import * as ordenes    from '../controllers/ordenes/ordenesController.js'
import * as workflow   from '../controllers/ordenes/workflowController.js'
import * as resultados from '../controllers/ordenes/resultadosController.js'
import * as fotos      from '../controllers/ordenes/fotosController.js'
import * as cierre     from '../controllers/ordenes/cierreController.js'
import * as pdf        from '../controllers/ordenes/pdfController.js'

const router = Router()
router.use(verifyToken)

const GERENTE_O_INGENIERO = ['gerente_soporte', 'ingeniero_soporte']
const SOLO_GERENTE        = ['gerente_soporte']

// ── CRUD base ───────────────────────────────────────────────────────────────
router.get('/',             ordenes.listar)
router.get('/:id',          ordenes.obtener)
router.post('/',            requireRole(GERENTE_O_INGENIERO), ordenes.crear)
router.patch('/:id/estado', requireRole(GERENTE_O_INGENIERO), ordenes.actualizarEstado)

// ── Workflow ────────────────────────────────────────────────────────────────
router.post('/:id/recepcion',             workflow.recepcionar)
router.post('/:id/iniciar-mantenimiento', workflow.iniciarMantenimiento)
router.patch('/:id/asignacion',           requireRole(SOLO_GERENTE), workflow.asignar)
router.patch('/:id/archivar',             requireRole(SOLO_GERENTE), workflow.archivar)
router.delete('/:id',                     requireRole(SOLO_GERENTE), workflow.eliminar)
router.post('/:id/reabrir',               requireRole(SOLO_GERENTE), workflow.reabrir)
router.post('/:id/rechazar',              requireRole(SOLO_GERENTE), workflow.rechazar)
router.post('/:id/revision',              requireRole(SOLO_GERENTE), workflow.mandarARevision)

// ── Resultados / fotos ──────────────────────────────────────────────────────
router.patch('/:id/puntos/:resultadoId',         resultados.actualizar)
router.post('/:id/puntos/:resultadoId/firmar',   resultados.firmar)
router.post('/:id/puntos/:resultadoId/fotos',    upload.single('foto'), fotos.subir)
router.delete('/:id/puntos/:resultadoId/fotos/:fotoId', fotos.eliminar)
router.post('/:id/puntos/:resultadoId/revision',     workflow.pedirRevision)
router.post('/:id/revisiones/:revisionId/resolver',  workflow.resolverRevision)

// ── Cierre / PDF ────────────────────────────────────────────────────────────
router.post('/:id/cierre',        cierre.gestionar)
router.post('/:id/cierre/firmar', cierre.firmar)
router.get('/:id/pdf',            pdf.generar)

export default router
