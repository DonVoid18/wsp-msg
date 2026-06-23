import { MessageTypes } from "whatsapp-web.js"

export interface Contact {
  phoneNumber: string
  pushname: string | null
}

export interface MessageClient {
  id: string
  from: string
  to: string
  body: string
  timestamp: number
  fromMe: boolean
  type: MessageTypes
}

export interface MessageAndContact {
  message: MessageClient
  contact: Contact
}

export interface WhatsappMessagePayload {
  to: string
  content: string
}
