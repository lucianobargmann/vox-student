import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { prisma } from './prisma';
import { whatsAppLogger, LogLevel, WhatsAppEventType } from './whatsapp-logger';

interface WhatsAppMessage {
  to: string;
  message: string;
  type?: 'text' | 'media';
}

interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface RateLimitInfo {
  canSend: boolean;
  nextAvailableTime?: Date;
  remainingTime?: number;
}

class WhatsAppService {
  private client: Client | null = null;
  private isReady: boolean = false;
  private isInitializing: boolean = false;
  private qrCode: string | null = null;
  private lastMessageTimes: Map<string, Date> = new Map();
  private readonly RATE_LIMIT_MS = 30 * 1000; // 30 seconds

  constructor() {
    // Skip initialization during build time (when NEXT_PHASE is set or during static generation)
    if (this.isBuildTime()) {
      return;
    }
    
    // Initialize on server startup if we have an authenticated session
    this.initializeIfPreviouslyAuthenticated();
  }

  private isBuildTime(): boolean {
    // Check for Next.js build-time environment variables
    return (
      process.env.NEXT_PHASE === 'phase-production-build' ||
      process.env.NEXT_PHASE === 'phase-export' ||
      process.env.NODE_ENV === undefined ||
      typeof window !== 'undefined' // Browser environment
    );
  }

  private async initializeIfPreviouslyAuthenticated(): Promise<void> {
    // Skip if running in browser environment
    if (typeof window !== 'undefined') {
      return;
    }

    try {
      const fs = await import('fs');
      const path = await import('path');
      
      // Check if we have an authenticated session
      const settings = await prisma.whatsAppSettings.findFirst();
      const isDBAuthenticated = settings?.isAuthenticated && settings?.enabled;
      
      // Check for physical session files
      const sessionPath = path.join(process.cwd(), 'whatsapp-session', 'session-voxstudent-whatsapp');
      const hasPhysicalSession = fs.existsSync(sessionPath) && 
                                 fs.existsSync(path.join(sessionPath, 'Default', 'Preferences'));
      
      // Initialize if we have either DB authentication or physical session AND WhatsApp is enabled
      const shouldInitialize = (isDBAuthenticated || hasPhysicalSession) && settings?.enabled;

      if (shouldInitialize) {
        // Use setTimeout to avoid blocking the constructor
        setTimeout(() => {
          this.restart().catch(error => {
            console.error('❌ Falha na reconexão automática:', error);
          });
        }, 1000); // Wait 1 second before attempting reconnection
      }
    } catch (error) {
      console.error('❌ Erro ao verificar sessão anterior:', error);
    }
  }

  private async initializeClient(): Promise<void> {
    if (this.isInitializing || this.client) {
      return;
    }

    this.isInitializing = true;

    try {
      // Check if WhatsApp is enabled in settings
      const isEnabled = await this.isWhatsAppEnabled();
      if (!isEnabled) {
        this.isInitializing = false;
        return;
      }

      // Clean up any stale singleton files before initializing
      await this.cleanupSingletonFiles();

      // Check if Chrome is available
      const chromePath = await this.findChromeBinary();
      if (!chromePath) {
        throw new Error('Chrome não encontrado. WhatsApp não pode ser inicializado em ambiente headless sem Chrome. Execute ./install-chrome.sh para instalar.');
      }

      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: 'voxstudent-whatsapp',
          dataPath: './whatsapp-session'
        }),
        puppeteer: {
          headless: true,
          executablePath: chromePath,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=VizDisplayCompositor',
            '--disable-web-security',
            '--disable-extensions',
            '--disable-plugins',
            '--disable-default-apps',
            '--disable-sync',
            '--metrics-recording-only',
            '--no-crash-upload',
            '--disable-crash-reporter',
            '--user-data-dir=/tmp/chrome-data-whatsapp',
            '--remote-debugging-port=0'
          ]
        }
      });

      this.setupEventHandlers();
      await this.client.initialize();

    } catch (error) {
      console.error('❌ Falha ao inicializar cliente WhatsApp:', error);
      this.isInitializing = false;
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('qr', async (qr) => {
      console.log('📱 QR Code do WhatsApp gerado');
      console.log('🔍 Tamanho do QR Code:', qr.length);
      console.log('🔍 Prévia do QR Code:', qr.substring(0, 50) + '...');
      this.qrCode = qr;

      // Save QR code to database
      try {
        await prisma.whatsAppSettings.upsert({
          where: { id: 'default' },
          create: {
            id: 'default',
            enabled: true,
            qrCode: qr,
            isAuthenticated: false,
            lastConnectionCheck: new Date()
          },
          update: {
            qrCode: qr,
            isAuthenticated: false,
            lastConnectionCheck: new Date()
          }
        });
        console.log('📱 QR Code salvo no banco de dados');
      } catch (error) {
        console.error('❌ Falha ao salvar QR code no banco:', error);
      }

      // Log QR code generation
      whatsAppLogger.logQRCode(qr);

      // Display QR code in terminal for development
      if (process.env.NODE_ENV === 'development') {
        console.log('📱 Escaneie este QR code com o WhatsApp:');
        qrcode.generate(qr, { small: true });
      }
    });

    this.client.on('ready', async () => {
      console.log('✅ Cliente WhatsApp está pronto!');
      this.isReady = true;
      this.isInitializing = false;
      this.qrCode = null;

      // Update database - clear QR code and mark as authenticated
      try {
        await prisma.whatsAppSettings.upsert({
          where: { id: 'default' },
          create: {
            id: 'default',
            enabled: true,
            qrCode: null,
            isAuthenticated: true,
            lastConnectionCheck: new Date()
          },
          update: {
            qrCode: null,
            isAuthenticated: true,
            lastConnectionCheck: new Date()
          }
        });
        console.log('✅ Status de conexão WhatsApp atualizado no banco');
      } catch (error) {
        console.error('❌ Falha ao atualizar status no banco:', error);
      }

      // Log connection establishment
      whatsAppLogger.logConnection(true);
    });

    this.client.on('authenticated', () => {
      console.log('✅ Cliente WhatsApp autenticado');

      // Log successful authentication
      whatsAppLogger.logAuthentication(true);
    });

    this.client.on('auth_failure', (msg) => {
      console.error('❌ WhatsApp authentication failed:', msg);
      this.isReady = false;
      this.isInitializing = false;

      // Log authentication failure
      whatsAppLogger.logAuthentication(false, undefined, new Error(msg));
    });

    this.client.on('disconnected', (reason) => {
      console.log('📱 Cliente WhatsApp desconectado:', reason);
      this.isReady = false;
      this.client = null;

      // Log connection loss
      whatsAppLogger.logConnection(false, undefined, { reason });

      // Attempt to reconnect after a delay
      setTimeout(() => {
        this.initializeClient();
      }, 5000);
    });

    this.client.on('message', async (message: Message) => {
      // Handle incoming messages if needed
      console.log('📨 Mensagem WhatsApp recebida:', message.body);
    });
  }

  private async isWhatsAppEnabled(): Promise<boolean> {
    try {
      const settings = await prisma.whatsAppSettings.findFirst();
      return settings?.enabled || false;
    } catch (error) {
      console.error('Erro ao verificar configurações WhatsApp:', error);
      return false;
    }
  }

  private checkRateLimit(phoneNumber: string): RateLimitInfo {
    const lastMessageTime = this.lastMessageTimes.get(phoneNumber);
    
    if (!lastMessageTime) {
      return { canSend: true };
    }

    const timeSinceLastMessage = Date.now() - lastMessageTime.getTime();
    
    if (timeSinceLastMessage >= this.RATE_LIMIT_MS) {
      return { canSend: true };
    }

    const remainingTime = this.RATE_LIMIT_MS - timeSinceLastMessage;
    const nextAvailableTime = new Date(Date.now() + remainingTime);

    return {
      canSend: false,
      nextAvailableTime,
      remainingTime
    };
  }

  private updateRateLimit(phoneNumber: string): void {
    this.lastMessageTimes.set(phoneNumber, new Date());
  }

  async sendMessage(messageData: WhatsAppMessage): Promise<SendMessageResult> {
    try {
      // Always try to sync with the global active instance
      const globalInstance = getWhatsAppServiceInstance();
      const isThisInstanceActive = globalInstance === this;
      
      // If this is not the active instance, delegate to the active one
      if (!isThisInstanceActive && globalInstance.isReady) {
        return globalInstance.sendMessage(messageData);
      }
      
      // If this is not ready but global instance is, sync state
      if (!this.isReady && globalInstance.isReady) {
        this.isReady = globalInstance.isReady;
        this.client = globalInstance.client;
      }
      
      if (!this.isReady || !this.client) {
        return {
          success: false,
          error: 'Cliente WhatsApp não está pronto. Certifique-se de que esteja inicializado e autenticado.'
        };
      }

      // Check rate limiting
      const rateLimitInfo = this.checkRateLimit(messageData.to);
      if (!rateLimitInfo.canSend) {
        // Log rate limit hit
        whatsAppLogger.logRateLimit(messageData.to, rateLimitInfo.remainingTime || 0);

        return {
          success: false,
          error: `Limite de taxa excedido. Próxima mensagem pode ser enviada em ${Math.ceil((rateLimitInfo.remainingTime || 0) / 1000)} segundos.`
        };
      }

      // Try sending message with international phone number formatting
      const result = await this.sendMessageWithInternationalFallback(messageData);
      
      if (result.success) {
        // Update rate limiting only on success
        this.updateRateLimit(messageData.to);

        // Log successful message
        whatsAppLogger.logMessage(true, messageData.to, result.messageId, undefined, {
          messageLength: messageData.message.length,
          messageType: messageData.type
        });
      } else {
        // Log failed message
        whatsAppLogger.logMessage(false, messageData.to, undefined, result.error, {
          messageLength: messageData.message.length,
          messageType: messageData.type
        });
      }

      return result;

    } catch (error) {
      console.error('❌ Falha crítica ao enviar mensagem WhatsApp:', error);

      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

      // Log failed message
      whatsAppLogger.logMessage(false, messageData.to, undefined, errorMessage, {
        messageLength: messageData.message.length,
        messageType: messageData.type
      });

      // Log the failed message to database
      await this.logMessage({
        recipientPhone: messageData.to,
        messageText: messageData.message,
        sentAt: new Date(),
        deliveryStatus: 'failed',
        errorMessage
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  private async sendMessageWithInternationalFallback(messageData: WhatsAppMessage): Promise<SendMessageResult> {
    // Get phone formats with international and Brazilian fallback logic
    const phoneFormats = this.getInternationalPhoneFormats(messageData.to);
    
    // Try primary format first
    try {
      const message = await this.client!.sendMessage(phoneFormats.primary, messageData.message);

      // Log the successful message to database
      await this.logMessage({
        recipientPhone: messageData.to,
        messageText: messageData.message,
        messageId: message.id.id,
        sentAt: new Date(),
        deliveryStatus: 'sent',
        actualWhatsAppId: phoneFormats.primary
      });

      return {
        success: true,
        messageId: message.id.id
      };

    } catch (primaryError) {
      // If primary fails and we have a fallback, try it
      if (phoneFormats.fallback && phoneFormats.fallback !== phoneFormats.primary) {
        try {
          const message = await this.client!.sendMessage(phoneFormats.fallback, messageData.message);

          // Log the successful message to database with fallback format
          await this.logMessage({
            recipientPhone: messageData.to,
            messageText: messageData.message,
            messageId: message.id.id,
            sentAt: new Date(),
            deliveryStatus: 'sent',
            actualWhatsAppId: phoneFormats.fallback
          });

          return {
            success: true,
            messageId: message.id.id
          };

        } catch (fallbackError) {
          const errorMessage = `Falha em ambos os formatos. Primário: ${primaryError instanceof Error ? primaryError.message : primaryError}. Fallback: ${fallbackError instanceof Error ? fallbackError.message : fallbackError}`;

          // Log the failed message to database
          await this.logMessage({
            recipientPhone: messageData.to,
            messageText: messageData.message,
            sentAt: new Date(),
            deliveryStatus: 'failed',
            errorMessage
          });

          return {
            success: false,
            error: errorMessage
          };
        }
      } else {
        const errorMessage = primaryError instanceof Error ? primaryError.message : 'Erro desconhecido';

        // Log the failed message to database
        await this.logMessage({
          recipientPhone: messageData.to,
          messageText: messageData.message,
          sentAt: new Date(),
          deliveryStatus: 'failed',
          errorMessage
        });

        return {
          success: false,
          error: errorMessage
        };
      }
    }
  }

  private getInternationalPhoneFormats(phoneNumber: string): { primary: string; fallback?: string } {
    const originalHasPlus = phoneNumber.startsWith('+');
    
    // Remove all non-numeric characters
    let cleaned = phoneNumber.replace(/\D/g, '');

    // Simple rule: + prefix = international, no + = Brazil
    if (originalHasPlus) {
      // International number with country code - use as-is
      return {
        primary: cleaned + '@c.us'
      };
    }

    // Handle Brazilian numbers with fallback logic
    if (cleaned.startsWith('55')) {
      // Already has country code
      const withoutCountryCode = cleaned.substring(2);
      
      if (withoutCountryCode.length === 11) {
        // Format: 55 + DD + 9XXXXXXXX (11 digits after country code)
        const areaCode = withoutCountryCode.substring(0, 2);
        const firstDigit = withoutCountryCode.substring(2, 3);
        
        if (firstDigit === '9') {
          // Has 9th digit - for Brazilian numbers, try WITHOUT 9 first (old accounts)
          const numberWith9 = cleaned + '@c.us';
          const numberWithout9 = '55' + areaCode + withoutCountryCode.substring(3) + '@c.us';
          
          return {
            primary: numberWithout9,
            fallback: numberWith9
          };
        } else {
          // Doesn't have 9th digit - add it for primary, keep original as fallback
          const numberWith9 = '55' + areaCode + '9' + withoutCountryCode.substring(2) + '@c.us';
          const numberWithout9 = cleaned + '@c.us';
          
          return {
            primary: numberWith9,
            fallback: numberWithout9
          };
        }
      } else if (withoutCountryCode.length === 10) {
        // Format: 55 + DD + XXXXXXXX (10 digits after country code)
        const areaCode = withoutCountryCode.substring(0, 2);
        const number = withoutCountryCode.substring(2);
        const numberWith9 = '55' + areaCode + '9' + number + '@c.us';
        const numberWithout9 = cleaned + '@c.us';
        
        return {
          primary: numberWith9,
          fallback: numberWithout9
        };
      }
    } else {
      // No country code, assume Brazil (+55)
      if (cleaned.length === 11) {
        // Format: DD + 9XXXXXXXX or DD + XXXXXXXX with extra digit
        const areaCode = cleaned.substring(0, 2);
        const firstDigit = cleaned.substring(2, 3);
        
        if (firstDigit === '9') {
          // Has 9th digit - for Brazilian numbers, try WITHOUT 9 first (old accounts)
          const numberWith9 = '55' + cleaned + '@c.us';
          const numberWithout9 = '55' + areaCode + cleaned.substring(3) + '@c.us';
          
          return {
            primary: numberWithout9,
            fallback: numberWith9
          };
        } else {
          // Add 9th digit for primary, keep as-is for fallback
          const numberWith9 = '55' + areaCode + '9' + cleaned.substring(2) + '@c.us';
          const numberWithout9 = '55' + cleaned + '@c.us';
          
          return {
            primary: numberWith9,
            fallback: numberWithout9
          };
        }
      } else if (cleaned.length === 10) {
        // Format: DD + XXXXXXXX (missing 9th digit)
        const areaCode = cleaned.substring(0, 2);
        const number = cleaned.substring(2);
        const numberWith9 = '55' + areaCode + '9' + number + '@c.us';
        const numberWithout9 = '55' + cleaned + '@c.us';
        
        return {
          primary: numberWith9,
          fallback: numberWithout9
        };
      }
    }

    // Fallback: return as-is with @c.us (no fallback)
    return {
      primary: cleaned + '@c.us'
    };
  }


  private async logMessage(messageData: {
    recipientPhone: string;
    messageText: string;
    messageId?: string;
    sentAt: Date;
    deliveryStatus: string;
    errorMessage?: string;
    messageType?: 'aula' | 'mentoria' | 'reposicao';
    actualWhatsAppId?: string;
  }): Promise<void> {
    try {
      await prisma.whatsAppMessage.create({
        data: {
          recipientPhone: messageData.recipientPhone,
          messageText: messageData.messageText,
          messageId: messageData.messageId,
          sentAt: messageData.sentAt,
          deliveryStatus: messageData.deliveryStatus,
          errorMessage: messageData.errorMessage,
          messageType: messageData.messageType
        }
      });
    } catch (error) {
      console.error('❌ Falha ao registrar mensagem no banco:', error);
    }
  }

  async sendMagicLink(phoneNumber: string, magicLinkToken: string): Promise<SendMessageResult> {
    const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const loginUrl = `${appUrl}/auth/verify?token=${magicLinkToken}`;

    const message = `🔐 *VoxStudent - Link de Acesso*

Olá! Você solicitou acesso ao VoxStudent.

Clique no link abaixo para fazer login:
${loginUrl}

⏰ *Este link expira em ${process.env.MAGIC_LINK_EXPIRY_MINUTES || 15} minutos.*

Se você não solicitou este acesso, pode ignorar esta mensagem com segurança.

© ${new Date().getFullYear()} VoxStudent - Sistema de Gestão Educacional`;

    return this.sendMessage({
      to: phoneNumber,
      message: message
    });
  }

  async sendReminderMessage(phoneNumber: string, template: string, placeholders: Record<string, string> = {}): Promise<SendMessageResult> {
    // Replace placeholders in template
    let message = template;
    for (const [key, value] of Object.entries(placeholders)) {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return this.sendMessage({
      to: phoneNumber,
      message: message
    });
  }

  async getConnectionStatus(): Promise<{
    isReady: boolean;
    isInitializing: boolean;
    qrCode: string | null;
    error?: string;
  }> {
    // Check if this is the active instance by trying to sync with global state
    const globalInstance = getWhatsAppServiceInstance();
    const isThisInstanceActive = globalInstance === this;

    // If this is not the active instance but we have a ready global instance, sync the state
    if (!isThisInstanceActive && globalInstance.isReady && !this.isReady) {
      this.isReady = globalInstance.isReady;
      this.isInitializing = globalInstance.isInitializing;
      this.client = globalInstance.client;
      this.qrCode = globalInstance.qrCode;
    }

    // If we don't have a QR code in memory but we're initializing,
    // check the database for a saved QR code
    let qrCode = this.qrCode;
    if (!qrCode && this.isInitializing) {
      try {
        const settings = await prisma.whatsAppSettings.findFirst();
        qrCode = settings?.qrCode || null;
      } catch (error) {
        console.error('Falha ao buscar QR code do banco:', error);
      }
    }

    return {
      isReady: this.isReady,
      isInitializing: this.isInitializing,
      qrCode,
    };
  }

  async verifyConnection(): Promise<boolean> {
    try {
      if (!this.client || !this.isReady) {
        return false;
      }

      // Try to get client info to verify connection
      const info = await this.client.info;
      return info !== null;
    } catch (error) {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.destroy();
        this.client = null;
        this.isReady = false;
        this.isInitializing = false;
        this.qrCode = null;
      }
    } catch (error) {
      console.error('❌ Falha ao desconectar cliente WhatsApp:', error);
    }
  }

  async restart(): Promise<void> {
    // Check if we already have an authenticated session
    const settings = await prisma.whatsAppSettings.findFirst();
    const isDBAuthenticated = settings?.isAuthenticated && settings?.enabled;
    
    // Check for physical session files
    const fs = await import('fs');
    const path = await import('path');
    const sessionPath = path.join(process.cwd(), 'whatsapp-session', 'session-voxstudent-whatsapp');
    const hasPhysicalSession = fs.existsSync(sessionPath) && 
                               fs.existsSync(path.join(sessionPath, 'Default', 'Preferences'));
    
    const shouldAttemptReconnect = (isDBAuthenticated || hasPhysicalSession) && settings?.enabled;
    
    if (shouldAttemptReconnect) {
      try {
        // If we already have a client, try to verify connection first
        if (this.client) {
          const isConnected = await this.verifyConnection();
          if (isConnected) {
            this.isReady = true;
            return;
          }
          
          // If verification fails, try to reinitialize without destroying session
          try {
            await this.client.initialize();
            return;
          } catch (reinitError) {
            // Continue to full restart
          }
        }
        
        // If no client exists or reinit failed, do full restart
        await this.fullRestart();
        
      } catch (error) {
        console.error('❌ Falha na reconexão:', error);
        await this.fullRestart();
      }
    } else {
      await this.fullRestart();
    }
  }

  async forceRestart(): Promise<void> {
    await this.fullRestart();
  }

  private async fullRestart(): Promise<void> {
    try {
      await this.disconnect();
      
      // Clean up any stale singleton files that might cause issues
      await this.cleanupSingletonFiles();
      
      await this.initializeClient();
    } catch (error) {
      console.error('❌ Erro durante reinício completo:', error);
      throw error;
    }
  }

  private async findChromeBinary(): Promise<string | undefined> {
    // Check environment variable first
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      return process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    try {
      const fs = await import('fs');
      
      // Common Chrome paths on Linux
      const chromePaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium'
      ];

      for (const path of chromePaths) {
        if (fs.existsSync(path)) {
          console.log(`✅ Chrome encontrado em: ${path}`);
          return path;
        }
      }

      console.log('⚠️ Chrome não encontrado. Execute ./install-chrome.sh para instalar');
      return undefined;
    } catch (error) {
      console.log('⚠️ Erro ao procurar Chrome:', error);
      return undefined;
    }
  }

  private async cleanupSingletonFiles(): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const sessionPath = path.join(process.cwd(), 'whatsapp-session', 'session-voxstudent-whatsapp');
      
      const filesToClean = [
        path.join(sessionPath, 'SingletonLock'),
        path.join(sessionPath, 'SingletonCookie'),
        path.join(sessionPath, 'SingletonSocket'),
        path.join(sessionPath, 'DevToolsActivePort')
      ];
      
      for (const file of filesToClean) {
        if (fs.existsSync(file)) {
          try {
            if (fs.lstatSync(file).isSymbolicLink()) {
              fs.unlinkSync(file);
            } else {
              fs.rmSync(file, { recursive: true, force: true });
            }
          } catch (cleanError) {
            // Ignore individual file cleanup errors
          }
        }
      }
    } catch (error) {
      // Cleanup is best effort, don't fail the restart
      console.log('⚠️ Aviso: Não foi possível limpar arquivos temporários');
    }
  }

  getRateLimitInfo(phoneNumber: string): RateLimitInfo {
    return this.checkRateLimit(phoneNumber);
  }
}

// Create true global singleton instance
const WHATSAPP_SERVICE_SYMBOL = Symbol.for('whatsapp.service.singleton');

function getWhatsAppServiceInstance(): WhatsAppService {
  const globalSymbols = globalThis as any;
  
  if (!globalSymbols[WHATSAPP_SERVICE_SYMBOL]) {
    globalSymbols[WHATSAPP_SERVICE_SYMBOL] = new WhatsAppService();
  }
  
  return globalSymbols[WHATSAPP_SERVICE_SYMBOL];
}

const whatsAppService = getWhatsAppServiceInstance();

// Export convenience functions
export async function sendWhatsAppMessage(phoneNumber: string, message: string): Promise<SendMessageResult> {
  return whatsAppService.sendMessage({ to: phoneNumber, message });
}

export async function sendWhatsAppMagicLink(phoneNumber: string, magicLinkToken: string): Promise<SendMessageResult> {
  return whatsAppService.sendMagicLink(phoneNumber, magicLinkToken);
}

export async function sendWhatsAppReminder(phoneNumber: string, template: string, placeholders: Record<string, string> = {}): Promise<SendMessageResult> {
  return whatsAppService.sendReminderMessage(phoneNumber, template, placeholders);
}

export async function getWhatsAppConnectionStatus() {
  return whatsAppService.getConnectionStatus();
}

export async function verifyWhatsAppConnection(): Promise<boolean> {
  return whatsAppService.verifyConnection();
}

export async function restartWhatsAppService(): Promise<void> {
  return whatsAppService.restart();
}

export default whatsAppService;
