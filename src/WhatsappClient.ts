import { EventEmitter } from "events"
import {
  Client,
  ClientOptions,
  Message,
  NoAuth
} from "whatsapp-web.js"
import {
  Contact,
  MessageAndContact,
  MessageClient,
  WhatsappMessagePayload
} from "./types"
import { sleep, waitingTimeBetweenMessages } from "./utils"

export class WhatsappClient extends EventEmitter {
  private client!: Client
  private isReady = false
  private isAuthenticated = false
  private lastQr: string | null = null
  private phoneRegistered: string | null = null
  private chromeExecutablePath: string | null = null

  constructor(config?: { chromeExecutablePath?: string }) {
    super()
    if (config?.chromeExecutablePath) {
      this.chromeExecutablePath = config.chromeExecutablePath
    }
  }

  /**
   * Inicializa el cliente de WhatsApp y configura los listeners de eventos
   */
  public initialize() {
    const puppeteerConfig: ClientOptions["puppeteer"] = {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-zygote",
        "--disable-gpu",
        "--unhandled-rejections=strict"
      ]
    }

    // Verificar si estamos en Windows para especificar la ruta del ejecutable de Chrome
    if (process.platform === "win32") {
      puppeteerConfig.executablePath =
        this.chromeExecutablePath ||
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    }

    this.client = new Client({
      authStrategy: new NoAuth(),
      puppeteer: puppeteerConfig,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
    })

    this.attachEventListeners()
    this.client.initialize()
  }

  private attachEventListeners() {
    this.client.on("qr", (qr) => {
      this.lastQr = qr
      console.log("QR recibido:", qr)
      this.emit("qr", qr)
    })

    this.client.on("ready", async () => {
      this.isReady = true
      this.isAuthenticated = true
      
      const clientInfo = this.client.info
      this.phoneRegistered = clientInfo.wid.user
      
      console.log(`⚡ Cliente de WhatsApp listo. Teléfono registrado: ${this.phoneRegistered}`)
      this.emit("ready")
    })

    this.client.on("message", async (message: Message) => {
      // Verificar que el mensaje no sea enviado por mí mismo
      if (message.fromMe || !message.body) return

      const [phoneNumber, typeMessage] = message.from.split("@")

      // Verificar que el mensaje sea enviado desde un número personal (no grupo)
      if (typeMessage !== "c.us") return

      console.log(`📩 Mensaje recibido de ${phoneNumber}: ${message.body}`)

      let pushname: string | null = null
      try {
        const contactInfo = await message.getContact()
        pushname = contactInfo.pushname || null
      } catch (error) {
        console.error("Error al obtener contacto:", error)
      }

      const contact: Contact = {
        phoneNumber,
        pushname
      }

      const messageParse: MessageClient = {
        id: message.id._serialized,
        from: message.from.split("@")[0],
        to: message.to.split("@")[0],
        body: message.body,
        timestamp: message.timestamp,
        fromMe: message.fromMe,
        type: message.type
      }

      const messageAndContact: MessageAndContact = {
        message: messageParse,
        contact
      }

      this.emit("message", messageAndContact)
    })

    this.client.on("authenticated", () => {
      console.log("Cliente autenticado con éxito")
      this.isAuthenticated = true
      this.emit("authenticated")
    })

    this.client.on("disconnected", () => {
      console.log("Cliente desconectado")
      this.emit("disconnected")
      this.isReady = false
      this.isAuthenticated = false
      this.phoneRegistered = null
      this.lastQr = null
    })
  }

  // Getters de estado
  public isClientReady(): boolean {
    return this.isReady
  }

  public isClientAuthenticated(): boolean {
    return this.isAuthenticated
  }

  public getLastQr(): string | null {
    return this.lastQr
  }

  public getPhoneRegistered(): string | null {
    return this.phoneRegistered
  }

  /**
   * Envía un mensaje de texto a un número de teléfono utilizando retardos y estados para evitar bloqueos
   */
  public async sendMessage({ to, content }: WhatsappMessagePayload) {
    if (!this.isReady) {
      throw new Error("El cliente de WhatsApp no está listo")
    }

    try {
      await this.client.sendPresenceAvailable()
      await sleep(waitingTimeBetweenMessages() / 4)

      const chatId = `${to}@c.us`
      const chat = await this.client.getChatById(chatId)

      await sleep(waitingTimeBetweenMessages() / 10)
      await chat.sendSeen()

      await sleep(waitingTimeBetweenMessages() / 10)
      await chat.sendStateTyping()

      await chat.sendMessage(content)

      await sleep(waitingTimeBetweenMessages() / 3)
      await this.client.sendPresenceUnavailable()

      console.log(`Se ha enviado correctamente el mensaje al ${to}`)
    } catch (error) {
      console.error(`Error al enviar mensaje a ${to}`, error)
      throw error
    }
  }

  /**
   * Cierra el cliente destruyendo la sesión actual de Puppeteer
   */
  public async logout() {
    if (this.client) {
      try {
        await this.client.destroy()
      } catch (error) {
        console.error("Error al destruir el cliente:", error)
      }
      this.isReady = false
      this.isAuthenticated = false
      console.log("🔴 Apagando cliente de WhatsApp...")
    }
  }
}
