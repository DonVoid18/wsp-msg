export { WhatsappClient } from "./WhatsappClient"
export * from "./types"
export { sleep, randomNumber, waitingTimeBetweenMessages } from "./utils"

// Si este archivo se ejecuta directamente (ej. pnpm start), se inicia el servidor de la API
if (require.main === module) {
  require("./server")
}
