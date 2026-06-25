import express from "express"
import * as dotenv from "dotenv"
import { WhatsappClient } from "./WhatsappClient"

dotenv.config()

const app = express()
app.use(express.json({ limit: "50mb" }))

const port = process.env.PORT || 3000
const chromeExecutablePath = process.env.CHROME_PATH || undefined
const supportedImageMimetypes = new Set(["image/jpeg", "image/jpg", "image/png"])

console.log("Iniciando API REST de WhatsApp...")
console.log(`Puerto configurado: ${port}`)

const client = new WhatsappClient({ chromeExecutablePath })

let lastQr: string | null = null

// Registrar eventos
client.on("qr", (qr) => {
  lastQr = qr
  console.log("Nuevo código QR generado.")
})

client.on("ready", () => {
  lastQr = null
  console.log("El cliente de WhatsApp está LISTO.")
})

client.on("authenticated", () => {
  console.log("Cliente autenticado con éxito.")
})

client.on("disconnected", () => {
  lastQr = null
  console.log("Cliente desconectado de WhatsApp.")
})

// Endpoints
app.get("/status", (req, res) => {
  res.json({
    ready: client.isClientReady(),
    authenticated: client.isClientAuthenticated(),
    phoneRegistered: client.getPhoneRegistered(),
    hasQr: !!lastQr
  })
})

app.get("/qr", (req, res) => {
  if (client.isClientReady()) {
    return res.send("<h1>El cliente ya está listo y conectado.</h1>")
  }
  if (!lastQr) {
    return res.send("<h1>Esperando la generación del código QR... Refresca en unos segundos.</h1>")
  }

  // Generar código QR utilizando un generador online por CDN
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(lastQr)}`

  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Escanea el Código QR - WhatsApp Standalone</title>
      <style>
        body {
          font-family: 'Inter', sans-serif;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          color: #f8fafc;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
        }
        .container {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 2.5rem;
          border-radius: 24px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          text-align: center;
          max-width: 400px;
        }
        h1 {
          font-size: 1.8rem;
          margin-bottom: 0.5rem;
          background: linear-gradient(to right, #10b981, #3b82f6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        p {
          color: #94a3b8;
          font-size: 0.95rem;
          margin-bottom: 2rem;
          line-height: 1.5;
        }
        .qr-wrapper {
          background: #ffffff;
          padding: 1.5rem;
          border-radius: 18px;
          display: inline-block;
          margin-bottom: 1.5rem;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
        }
        img {
          display: block;
        }
        .footer {
          margin-top: 1rem;
          font-size: 0.8rem;
          color: #64748b;
        }
      </style>
      <script>
        // Recargar automáticamente cada 5 segundos si el estado cambia a conectado
        setInterval(() => {
          fetch('/status')
            .then(res => res.json())
            .then(data => {
              if (data.ready) {
                window.location.reload();
              }
            });
        }, 5000);
      </script>
    </head>
    <body>
      <div class="container">
        <h1>Iniciar Sesión en WhatsApp</h1>
        <p>Abre WhatsApp en tu teléfono, ve a Dispositivos vinculados y escanea el código QR.</p>
        <div class="qr-wrapper">
          <img src="${qrImageUrl}" alt="Código QR de WhatsApp" width="300" height="300">
        </div>
        <div class="footer">Esta página se actualizará automáticamente una vez vinculado.</div>
      </div>
    </body>
    </html>
  `)
})

app.post("/send", async (req, res) => {
  const { to, content, image } = req.body

  if (!to) {
    return res.status(400).json({
      success: false,
      error: "El campo 'to' es obligatorio."
    })
  }

  if (!content && !image) {
    return res.status(400).json({
      success: false,
      error: "Debe proporcionar al menos 'content' o una 'image' para enviar."
    })
  }

  if (
    image &&
    (typeof image.mimetype !== "string" ||
      !image.mimetype.trim() ||
      typeof image.data !== "string" ||
      !image.data.trim())
  ) {
    return res.status(400).json({
      success: false,
      error: "La estructura de 'image' requiere 'mimetype' y 'data' (base64)."
    })
  }

  if (image && !supportedImageMimetypes.has(image.mimetype.toLowerCase())) {
    return res.status(400).json({
      success: false,
      error: `Mimetype de imagen no permitido: '${image.mimetype}'. Use image/jpeg o image/png.`
    })
  }

  try {
    await client.sendMessage({ to, content, image })
    res.json({
      success: true,
      message: "Mensaje enviado o encolado exitosamente."
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Fallo interno al procesar el envío del mensaje."
    })
  }
})

app.get("/groups", async (req, res) => {
  try {
    const groups = await client.getGroups()
    res.json({
      success: true,
      groups
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Fallo al obtener la lista de grupos."
    })
  }
})

// Iniciar el cliente de WhatsApp
client.initialize()

// Escuchar peticiones HTTP
const server = app.listen(port, () => {
  console.log(`🚀 Servidor API REST escuchando en http://localhost:${port}`)
})

// Manejo de apagado ordenado
export function shutdown() {
  console.log("\nApagando servidor API y deteniendo cliente de WhatsApp...")
  server.close(async () => {
    await client.logout()
    process.exit(0)
  })
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
