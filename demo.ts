import * as dotenv from "dotenv"
import * as qrcode from "qrcode-terminal"
import { WhatsappClient } from "./src"

// Cargar variables de entorno
dotenv.config()

const chromeExecutablePath = process.env.CHROME_PATH || undefined
console.log("Inicializando demostración del cliente de WhatsApp...")

const client = new WhatsappClient({ chromeExecutablePath })

// Registrar eventos
client.on("qr", (qr) => {
  console.log("\n--- ESCANEA EL CÓDIGO QR PARA INICIAR SESIÓN ---")
  qrcode.generate(qr, { small: true })
})

client.on("authenticated", () => {
  console.log("¡Cliente autenticado con éxito!")
})

client.on("ready", async () => {
  console.log("¡El cliente de WhatsApp está LISTO para enviar y recibir mensajes!")

  // Imprimir el número registrado
  const registeredPhone = client.getPhoneRegistered()
  console.log(`Teléfono registrado: ${registeredPhone}`)

  // Ejemplo de envío de mensaje de prueba si hay un número configurado en el .env o una variable de prueba
  const testNumber = process.env.TEST_NUMBER
  if (testNumber) {
    console.log(`Enviando mensaje de prueba a: ${testNumber}`)
    try {
      await client.sendMessage({
        to: testNumber,
        content: "Hola! Este es un mensaje de prueba automático desde el cliente de WhatsApp independiente."
      })
      console.log("Mensaje de prueba enviado con éxito.")
    } catch (err) {
      console.error("Error al enviar mensaje de prueba:", err)
    }
  } else {
    console.log("Define la variable 'TEST_NUMBER' en tu archivo .env para enviar un mensaje de prueba automático al iniciar.")
  }
})

client.on("message", async (msgAndContact) => {
  const { message, contact } = msgAndContact
  console.log(`\n💬 Mensaje recibido de ${contact.phoneNumber} (${contact.pushname || 'Sin Nombre'}):`)
  console.log(`Cuerpo: ${message.body}`)

  // Auto-responder opcional
  // if (message.body.toLowerCase() === "ping") {
  //   console.log("Respondiendo con pong...")
  //   try {
  //     await client.sendMessage({
  //       to: message.from,
  //       content: "pong 🏓"
  //     })
  //   } catch (err) {
  //     console.error("Error al enviar respuesta pong:", err)
  //   }
  // }
})

client.on("disconnected", () => {
  console.log("El cliente se ha desconectado.")
})

// Iniciar cliente
client.initialize()

// Manejar apagado ordenado
process.on("SIGINT", async () => {
  console.log("\nDeteniendo cliente...")
  await client.logout()
  process.exit(0)
})
