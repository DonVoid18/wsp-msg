import { EventEmitter } from "events"
import {
  Client,
  ClientOptions,
  Message,
  MessageMedia,
  NoAuth
} from "whatsapp-web.js"
import {
  Contact,
  MessageAndContact,
  MessageClient,
  WhatsappMessagePayload
} from "./types"
import { sleep, waitingTimeBetweenMessages } from "./utils"

interface QueueItem {
  payload: WhatsappMessagePayload
  resolve: (value: void) => void
  reject: (reason: any) => void
}

export class WhatsappClient extends EventEmitter {
  private client!: Client
  private isReady = false
  private isAuthenticated = false
  private lastQr: string | null = null
  private phoneRegistered: string | null = null
  private chromeExecutablePath: string | null = null
  private queue: QueueItem[] = []
  private isProcessingQueue = false

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

    // Configurar la ruta del ejecutable de Chrome/Chromium si se proporciona o si estamos en Windows
    if (this.chromeExecutablePath) {
      puppeteerConfig.executablePath = this.chromeExecutablePath
    } else if (process.platform === "win32") {
      puppeteerConfig.executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
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
      this.clearQueue(new Error("El cliente se ha desconectado"))
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
   * Limpia la cola de mensajes rechazando todos los pendientes
   */
  private clearQueue(error: Error) {
    while (this.queue.length > 0) {
      const item = this.queue.shift()
      if (item) {
        item.reject(error)
      }
    }
  }

  /**
   * Encola un mensaje para ser enviado de forma secuencial
   */
  public sendMessage({ to, content, image }: WhatsappMessagePayload): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        payload: { to, content, image },
        resolve,
        reject
      })
      this.processQueue()
    })
  }

  /**
   * Procesa la cola de mensajes secuencialmente
   */
  private async processQueue() {
    if (this.isProcessingQueue) return
    this.isProcessingQueue = true

    while (this.queue.length > 0) {
      const item = this.queue.shift()
      if (!item) continue

      try {
        await this.sendDirect(item.payload)
        item.resolve()
      } catch (error) {
        item.reject(error)
      }
    }

    this.isProcessingQueue = false
  }

  /**
   * Envía un mensaje directamente utilizando retardos y estados para evitar bloqueos
   */
  private async sendDirect({ to, content, image }: WhatsappMessagePayload) {
    if (!this.isReady) {
      throw new Error("El cliente de WhatsApp no está listo")
    }

    try {
      await this.client.sendPresenceAvailable()
      await sleep(waitingTimeBetweenMessages() / 4)

      let chatId = to
      if (!chatId.includes("@")) {
        if (chatId.includes("-") || chatId.length > 15) {
          chatId = `${chatId}@g.us`
        } else {
          chatId = `${chatId}@c.us`
        }
      }
      const chat = await this.client.getChatById(chatId)

      await sleep(waitingTimeBetweenMessages() / 10)
      await chat.sendSeen()

      await sleep(waitingTimeBetweenMessages() / 10)
      await chat.sendStateTyping()

      if (image) {
        // MessageMedia espera únicamente el contenido Base64. También admitimos
        // data URLs para que los consumidores no tengan que normalizarlas antes.
        const base64Data = image.data.replace(/^data:[^;]+;base64,/, "")
        const mimetype = image.mimetype.toLowerCase() === "image/jpg" ? "image/jpeg" : image.mimetype.toLowerCase()
        const defaultFilename = mimetype === "image/png" ? "image.png" : "image.jpg"
        const media = new MessageMedia(mimetype, base64Data, image.filename || defaultFilename)
        await chat.sendMessage(media, content ? { caption: content } : undefined)
      } else {
        await chat.sendMessage(content || "")
      }

      await sleep(waitingTimeBetweenMessages() / 3)
      await this.client.sendPresenceUnavailable()

      console.log(`Se ha enviado correctamente el mensaje al ${to}`)
    } catch (error) {
      console.error(`Error al enviar mensaje a ${to}`, error)
      throw error
    }
  }

  /**
   * Obtiene la lista de grupos en los que participa el cliente
   */
  public async getGroups(): Promise<Array<{ id: string; name: string }>> {
    if (!this.isReady) {
      throw new Error("El cliente de WhatsApp no está listo")
    }

    try {
      const chats = await this.client.getChats()
      const groups = chats.filter((chat) => chat.isGroup)
      return groups.map((group) => ({
        id: group.id._serialized,
        name: group.name
      }))
    } catch (error) {
      console.error("Error al obtener la lista de grupos:", error)
      throw error
    }
  }

  /**
   * Cierra el cliente destruyendo la sesión actual de Puppeteer
   */
  public async logout() {
    this.clearQueue(new Error("El cliente se está cerrando"))
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
