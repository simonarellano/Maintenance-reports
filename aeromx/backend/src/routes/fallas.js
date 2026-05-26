import { Router } from 'express'
import { verifyToken, requireRole } from '../middleware/auth.js'
// import { upload } from '../middleware/upload.js'                      // Tarea 6
import * as fallas from '../controllers/fallas/fallasController.js'
import * as workflow from '../controllers/fallas/workflowController.js'
// import * as fotos from '../controllers/fallas/fotosController.js'     // Tarea 6
// import * as pdf from '../controllers/fallas/pdfController.js'         // Tarea 7

const router = Router()
router.use(verifyToken)

router.get('/', fallas.listar)
router.get('/:id', fallas.obtener)
router.post('/', fallas.crear)
router.patch('/:id/responsable', requireRole(['gerente_soporte']), workflow.asignarResponsable)
router.post('/:id/resolver', workflow.resolver)
// router.post('/:id/fotos', upload.single('foto'), fotos.subir)         // Tarea 6
// router.delete('/:id/fotos/:fotoId', fotos.eliminar)                   // Tarea 6
// router.get('/:id/pdf', pdf.generar)                                   // Tarea 7

export default router
