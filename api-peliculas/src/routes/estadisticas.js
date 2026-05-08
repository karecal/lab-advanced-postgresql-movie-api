const { Router } = require('express')
const router = Router()

const {
  obtenerEstadisticas,
  estadisticasDirectores,
  estadisticasGeneros
} = require('../controllers/peliculasController')

// GET /api/estadisticas
router.get('/', obtenerEstadisticas)

// GET /api/estadisticas/directores
router.get('/directores', estadisticasDirectores)

// GET /api/estadisticas/generos
router.get('/generos', estadisticasGeneros)

module.exports = router
