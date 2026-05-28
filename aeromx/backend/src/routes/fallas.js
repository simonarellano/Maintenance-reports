import { Router } from 'express'
import { verifyToken, requireRole } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'
import * as fallas from '../controllers/fallas/fallasController.js'
import * as workflow from '../controllers/fallas/workflowController.js'
import * as fotos from '../controllers/fallas/fotosController.js'
import * as pdf from '../controllers/fallas/pdfController.js'
import * as estadisticas from '../controllers/fallas/estadisticasController.js'
import * as resumenPdf from '../controllers/fallas/resumenPdfController.js'
import * as excel from '../controllers/fallas/excelController.js'

const router = Router()
router.use(verifyToken)

// Rutas estáticas ANTES de '/:id' (si no, '/:id' captura "estadisticas", etc.)
router.get('/estadisticas', estadisticas.obtener)
router.get('/reporte.pdf', resumenPdf.generar)
router.get('/export.xlsx', excel.generar)

router.get('/', fallas.listar)
router.get('/:id', fallas.obtener)
router.post('/', fallas.crear)
router.patch('/:id/responsable', requireRole(['gerente_soporte']), workflow.asignarResponsable)
router.post('/:id/resolver', workflow.resolver)
router.post('/:id/fotos', upload.single('foto'), fotos.subir)
router.delete('/:id/fotos/:fotoId', fotos.eliminar)
router.get('/:id/pdf', pdf.generar)

export default router
