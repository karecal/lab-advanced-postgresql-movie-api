// index.js
require('dotenv').config()
require('./src/config/db') // Esto ejecuta el pool.connect de verificación

const express = require('express')
const app = express()
const peliculasRouter = require('./src/routes/peliculas')
const estadisticasRouter = require('./src/routes/estadisticas')
const webhooksRouter = require('./src/routes/webhooks')
const authRouter = require('./src/routes/auth')
const PORT = process.env.PORT || 3000

// Middleware global
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/webhooks', webhooksRouter)

// Rutas
app.use('/api/peliculas', peliculasRouter)
app.use('/api/estadisticas', estadisticasRouter)

// 404 global
app.use((req, res) => {
  res.status(404).json({ error: `Ruta ${req.method} ${req.url} no encontrada` })
})

app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`)
})
