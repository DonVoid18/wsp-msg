# WhatsApp Standalone Service

Este módulo proporciona una biblioteca independiente y ligera escrita en TypeScript para gestionar conexiones, recibir eventos y enviar mensajes a través de WhatsApp utilizando `whatsapp-web.js` y `puppeteer`.

Se ha desacoplado por completo de NestJS, colas de Bull y otros servicios de negocio, facilitando su integración en cualquier aplicación Node.js.

## Características

- Inicialización automática de cliente de WhatsApp.
- Manejo automático de rutas de Google Chrome en sistemas Windows.
- Eventos de conexión: `qr`, `ready`, `authenticated`, `disconnected`, `logout`.
- Recepción de mensajes en tiempo real (`message`).
- Envío de mensajes de texto y archivos/multimedia (`sendMessage`, `sendMessageWeb`).
- Obtención del historial de chats (`getChatHistory`).
- Consulta de la lista de contactos con paginación integrada (`getContacts`).
- Marcado de mensajes como leídos (`markContactMessagesAsRead`).

## Requisitos Previos

- **Node.js**: >= 18
- **Google Chrome**: En sistemas Windows, se recomienda tener Google Chrome instalado (por defecto busca en `C:\Program Files\Google\Chrome\Application\chrome.exe` o a través de la variable `CHROME_PATH`).

## Configuración e Instalación

1. Navega a la carpeta e instala las dependencias:
   ```bash
   cd whatsapp-standalone
   pnpm install
   # o bien: npm install
   ```

2. Configura las variables de entorno creando un archivo `.env` basado en `.env.example`:
   ```bash
   cp .env.example .env
   ```

3. Edita las variables de entorno en `.env`:
   - `NUM_DOC`: Identificador o identificador de cliente.
   - `CHROME_PATH`: (Opcional) Ruta completa del ejecutable de Chrome en Windows.
   - `TEST_NUMBER`: (Opcional) Número telefónico al que enviar un mensaje de prueba al conectar (formato `51999999999`).

## Uso del Script de Demostración

Puedes probar el cliente directamente ejecutando la demo:

```bash
pnpm demo
# o bien: npm run demo
```

Este comando compilará y ejecutará el archivo `demo.ts`. Mostrará un código QR en la consola que podrás escanear con la aplicación de WhatsApp en tu teléfono.

## Integración en tu Código

Para importar y utilizar el cliente en tu propio proyecto Node.js/TypeScript:

```typescript
import { WhatsappClient } from "./src";

// Instancia el cliente
const client = new WhatsappClient({
  chromeExecutablePath: process.env.CHROME_PATH // Opcional
});

// Registrar eventos
client.on("qr", (qr) => {
  console.log("Nuevo código QR:", qr);
});

client.on("ready", () => {
  console.log("Cliente conectado y listo.");
});

client.on("message", (messageAndContact) => {
  const { message, contact } = messageAndContact;
  console.log(`Mensaje recibido de ${contact.phoneNumber}: ${message.body}`);
});

// Inicializar la conexión
client.initialize();
```

## Referencia de la API

### Clase `WhatsappClient` (extends `EventEmitter`)

#### Métodos Públicos
- `initialize()`: Inicializa el cliente y abre el navegador de Puppeteer.
- `logout()`: Cierra sesión de WhatsApp y apaga el cliente de forma ordenada.
- `logoutClient()`: Apaga y vuelve a inicializar el cliente para forzar un nuevo logueo.
- `sendMessage({ to, content, files })`: Envía un mensaje a un número.
- `sendMessageWeb({ to, content, files, tempId })`: Envía un mensaje emitiendo un evento al finalizar indicando éxito/error.
- `getChatHistory(phoneNumber, limit)`: Retorna un arreglo de `MessageClient` correspondientes al historial.
- `getContacts(pageAndPaginationActive)`: Obtiene la lista de chats/contactos paginada.
- `markContactMessagesAsRead(phoneNumber)`: Envía señal de leído para los mensajes de un número específico.
- `isClientReady()`: Retorna `true` si el cliente está listo para operar.
- `isClientAuthenticated()`: Retorna `true` si el cliente está autenticado.
- `getLastQr()`: Retorna el último string de código QR recibido.
- `getPhoneRegistered()`: Retorna el número telefónico del dispositivo conectado.
