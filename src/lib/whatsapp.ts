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
    const timestamp = new Date().toISOString();
    console.log(`🔍 Construtor do serviço WhatsApp chamado em ${timestamp}`);
    console.log('🔍 Stack trace do construtor:', new Error().stack?.split('\n').slice(1, 4));
    
    // Initialize on server startup if we have an authenticated session
    this.initializeIfPreviouslyAuthenticated();
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
      
      console.log('🔍 Verificando sessão anterior:', {
        hasSettings: !!settings,
        isDBAuthenticated: settings?.isAuthenticated,
        isEnabled: settings?.enabled,
        hasPhysicalSession,
        sessionPath,
        shouldAutoInit: (isDBAuthenticated || hasPhysicalSession) && settings?.enabled
      });

      // Initialize if we have either DB authentication or physical session AND WhatsApp is enabled
      const shouldInitialize = (isDBAuthenticated || hasPhysicalSession) && settings?.enabled;

      if (shouldInitialize) {
        if (!isDBAuthenticated && hasPhysicalSession) {
          console.log('🔧 Sessão física encontrada mas DB não atualizado, tentando reconectar e sincronizar...');
        } else {
          console.log('✅ Sessão autenticada encontrada, iniciando reconexão automática...');
        }
        
        // Use setTimeout to avoid blocking the constructor
        setTimeout(() => {
          this.restart().catch(error => {
            console.error('❌ Falha na reconexão automática:', error);
          });
        }, 1000); // Wait 1 second before attempting reconnection
      } else {
        console.log('ℹ️ Nenhuma sessão válida encontrada ou WhatsApp desabilitado, aguardando inicialização manual');
      }
    } catch (error) {
      console.error('❌ Erro ao verificar sessão anterior:', error);
    }
  }

  private async initializeClient(): Promise<void> {
    if (this.isInitializing || this.client) {
      console.log('🔍 Pulando inicialização - já inicializando ou cliente existe:', {
        isInitializing: this.isInitializing,
        hasClient: !!this.client
      });
      return;
    }

    console.log('🔍 Iniciando inicialização do cliente WhatsApp...');
    this.isInitializing = true;

    try {
      // Check if WhatsApp is enabled in settings
      const isEnabled = await this.isWhatsAppEnabled();
      console.log('🔍 Verificação WhatsApp habilitado:', isEnabled);
      if (!isEnabled) {
        console.log('📱 Integração WhatsApp está desabilitada');
        this.isInitializing = false;
        return;
      }

      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: 'voxstudent-whatsapp',
          dataPath: './whatsapp-session'
        }),
        puppeteer: {
          headless: true,
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
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
            '--disable-renderer-backgrounding'
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
      console.log('🔍 Configurações WhatsApp do banco:', {
        enabled: settings?.enabled,
        isAuthenticated: settings?.isAuthenticated,
        phoneNumber: settings?.phoneNumber,
        lastCheck: settings?.lastConnectionCheck
      });
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
      
      console.log('🔍 sendMessage chamado - Estado:', {
        isReady: this.isReady,
        hasClient: !!this.client,
        isInitializing: this.isInitializing,
        isActiveInstance: isThisInstanceActive,
        globalInstanceReady: globalInstance.isReady,
        globalHasClient: !!globalInstance.client
      });
      
      // If this is not the active instance, delegate to the active one
      if (!isThisInstanceActive && globalInstance.isReady) {
        console.log('🔍 Delegando para instância global ativa...');
        return globalInstance.sendMessage(messageData);
      }
      
      // If this is not ready but global instance is, sync state
      if (!this.isReady && globalInstance.isReady) {
        console.log('🔍 Sincronizando estado antes de enviar...');
        this.isReady = globalInstance.isReady;
        this.client = globalInstance.client;
      }
      
      if (!this.isReady || !this.client) {
        console.log('❌ Cliente não está pronto para enviar mensagem');
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

      // Try sending message with Brazil 9-digit fallback logic
      const result = await this.sendMessageWithBrazilFallback(messageData);
      
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

  private async sendMessageWithBrazilFallback(messageData: WhatsAppMessage): Promise<SendMessageResult> {
    // Get both possible formats for Brazilian numbers
    const phoneFormats = this.getBrazilianPhoneFormats(messageData.to);
    
    console.log('📱 Tentando envio com fallback brasileiro:', {
      original: messageData.to,
      primaryFormat: phoneFormats.primary,
      fallbackFormat: phoneFormats.fallback
    });

    // Try primary format first
    try {
      console.log('🔄 Tentativa 1: formato primário', phoneFormats.primary);
      const message = await this.client!.sendMessage(phoneFormats.primary, messageData.message);
      
      console.log('✅ Mensagem enviada com sucesso no formato primário:', message.id.id);

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
      console.log('⚠️ Falha no formato primário, tentando fallback...', primaryError);

      // If primary fails and we have a fallback, try it
      if (phoneFormats.fallback && phoneFormats.fallback !== phoneFormats.primary) {
        try {
          console.log('🔄 Tentativa 2: formato fallback', phoneFormats.fallback);
          const message = await this.client!.sendMessage(phoneFormats.fallback, messageData.message);
          
          console.log('✅ Mensagem enviada com sucesso no formato fallback:', message.id.id);

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
          console.error('❌ Falha em ambos os formatos:', {
            primaryError: primaryError instanceof Error ? primaryError.message : primaryError,
            fallbackError: fallbackError instanceof Error ? fallbackError.message : fallbackError
          });

          const errorMessage = `Falha em ambos os formatos de número brasileiro. Primário: ${primaryError instanceof Error ? primaryError.message : primaryError}. Fallback: ${fallbackError instanceof Error ? fallbackError.message : fallbackError}`;

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
        console.error('❌ Falha no formato primário e sem fallback disponível:', primaryError);
        
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

  private getBrazilianPhoneFormats(phoneNumber: string): { primary: string; fallback?: string } {
    // Remove all non-numeric characters
    let cleaned = phoneNumber.replace(/\D/g, '');

    console.log('🔍 Analisando número brasileiro:', {
      original: phoneNumber,
      cleaned: cleaned,
      length: cleaned.length
    });

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
          
          console.log('📱 Número com 9º dígito - tentará SEM 9 primeiro (contas antigas BR), fallback com 9');
          return {
            primary: numberWithout9,
            fallback: numberWith9
          };
        } else {
          // Doesn't have 9th digit - add it for primary, keep original as fallback
          const numberWith9 = '55' + areaCode + '9' + withoutCountryCode.substring(2) + '@c.us';
          const numberWithout9 = cleaned + '@c.us';
          
          console.log('📱 Número sem 9º dígito - tentará com 9 primeiro, fallback sem 9');
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
        
        console.log('📱 Número 10 dígitos - tentará com 9 primeiro, fallback sem 9');
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
          
          console.log('📱 Número 11 dígitos com 9 - tentará SEM 9 primeiro (contas antigas BR), fallback com 9');
          return {
            primary: numberWithout9,
            fallback: numberWith9
          };
        } else {
          // Add 9th digit for primary, keep as-is for fallback
          const numberWith9 = '55' + areaCode + '9' + cleaned.substring(2) + '@c.us';
          const numberWithout9 = '55' + cleaned + '@c.us';
          
          console.log('📱 Número 11 dígitos sem 9 - tentará com 9 primeiro, fallback sem 9');
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
        
        console.log('📱 Número 10 dígitos - tentará com 9 primeiro, fallback sem 9');
        return {
          primary: numberWith9,
          fallback: numberWithout9
        };
      }
    }

    // Fallback: return as-is with @c.us (no fallback)
    console.log('⚠️ Formato não reconhecido, usando como está sem fallback');
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
    
    console.log('🔍 Verificação de instância:', {
      isThisInstanceActive,
      thisInstanceReady: this.isReady,
      globalInstanceReady: globalInstance.isReady,
      thisHasClient: !!this.client,
      globalHasClient: !!globalInstance.client
    });

    // If this is not the active instance but we have a ready global instance, sync the state
    if (!isThisInstanceActive && globalInstance.isReady && !this.isReady) {
      console.log('🔍 Sincronizando com instância global ativa...');
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
        console.log('🔍 QR code buscado do banco:', qrCode ? 'EXISTE' : 'NULO');
      } catch (error) {
        console.error('Falha ao buscar QR code do banco:', error);
      }
    }

    console.log('🔍 Resultado getConnectionStatus:', {
      isReady: this.isReady,
      isInitializing: this.isInitializing,
      qrCodeDaMemoria: this.qrCode ? 'EXISTE' : 'NULO',
      qrCodeFinal: qrCode ? 'EXISTE' : 'NULO',
      hasClient: !!this.client,
      clientState: this.client?.info ? 'conectado' : 'desconectado',
      isActiveInstance: isThisInstanceActive
    });

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
      console.log('✅ Conexão WhatsApp verificada:', info.wid.user);
      return true;
    } catch (error) {
      console.error('❌ WhatsApp connection verification failed:', error);
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
        console.log('✅ Cliente WhatsApp desconectado');
      }
    } catch (error) {
      console.error('❌ Falha ao desconectar cliente WhatsApp:', error);
    }
  }

  async restart(): Promise<void> {
    console.log('🔍 Verificando status do serviço WhatsApp...');
    
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
      console.log('🔍 Sessão encontrada, tentando reconectar...', {
        isDBAuthenticated,
        hasPhysicalSession,
        isEnabled: settings?.enabled
      });
      
      try {
        // If we already have a client, try to verify connection first
        if (this.client) {
          const isConnected = await this.verifyConnection();
          if (isConnected) {
            console.log('✅ Conexão já está ativa, não é necessário reiniciar');
            this.isReady = true;
            return;
          }
          
          // If verification fails, try to reinitialize without destroying session
          console.log('🔍 Tentando reinicializar cliente existente...');
          try {
            await this.client.initialize();
            return;
          } catch (reinitError) {
            console.log('⚠️ Falha na reinicialização, tentando restart completo...');
          }
        }
        
        // If no client exists or reinit failed, do full restart
        console.log('🔍 Iniciando cliente do zero...');
        await this.fullRestart();
        
      } catch (error) {
        console.error('❌ Falha na reconexão, fazendo restart completo...', error);
        await this.fullRestart();
      }
    } else {
      console.log('🔍 Nenhuma sessão válida encontrada ou WhatsApp desabilitado, fazendo restart completo...');
      await this.fullRestart();
    }
  }

  async forceRestart(): Promise<void> {
    console.log('🔍 Forçando restart completo do serviço WhatsApp...');
    await this.fullRestart();
  }

  private async fullRestart(): Promise<void> {
    console.log('🔍 Fazendo restart completo do serviço WhatsApp...');
    await this.disconnect();
    console.log('🔍 Desconectado, agora inicializando...');
    await this.initializeClient();
    console.log('🔍 Restart completo finalizado');
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
    console.log('🔍 Criando NOVA instância singleton global do WhatsApp Service');
    globalSymbols[WHATSAPP_SERVICE_SYMBOL] = new WhatsAppService();
  } else {
    console.log('🔍 Reutilizando instância singleton EXISTENTE do WhatsApp Service');
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
