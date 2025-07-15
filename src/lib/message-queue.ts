import { prisma } from './prisma';
import whatsAppService from './whatsapp';

export interface QueuedMessage {
  id: string;
  recipientPhone: string;
  messageText: string;
  messageType?: 'aula' | 'mentoria' | 'reposicao' | 'general';
  priority: number; // 1 = highest, 5 = lowest
  scheduledFor: Date;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
  createdAt: Date;
  lastAttemptAt?: Date;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export class MessageQueue {
  private static instance: MessageQueue;
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private readonly RATE_LIMIT_MS = 30 * 1000; // 30 seconds between messages
  private readonly PROCESSING_INTERVAL_MS = 5 * 1000; // Check queue every 5 seconds
  private readonly MAX_RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes max delay between retries

  private constructor() {
    this.startProcessing();
  }

  static getInstance(): MessageQueue {
    if (!MessageQueue.instance) {
      MessageQueue.instance = new MessageQueue();
    }
    return MessageQueue.instance;
  }

  /**
   * Add a message to the queue
   */
  async enqueue(message: {
    recipientPhone: string;
    messageText: string;
    messageType?: 'aula' | 'mentoria' | 'reposicao' | 'general';
    priority?: number;
    scheduledFor?: Date;
    maxAttempts?: number;
    metadata?: Record<string, any>;
  }): Promise<string> {
    try {
      // Create queue entry in database
      const queueEntry = await prisma.messageQueue.create({
        data: {
          recipientPhone: message.recipientPhone,
          messageText: message.messageText,
          messageType: message.messageType || 'general',
          priority: message.priority || 3,
          scheduledFor: message.scheduledFor || new Date(),
          attempts: 0,
          maxAttempts: message.maxAttempts || 3,
          status: 'pending',
          metadata: message.metadata ? JSON.stringify(message.metadata) : null
        }
      });

      console.log(`📨 Mensagem enfileirada com ID: ${queueEntry.id}`);
      return queueEntry.id;
    } catch (error) {
      console.error('❌ Erro ao enfileirar mensagem:', error);
      throw error;
    }
  }

  /**
   * Start processing the queue
   */
  private startProcessing(): void {
    if (this.processingInterval) {
      return;
    }

    console.log('🚀 Iniciando processamento da fila de mensagens...');
    this.processingInterval = setInterval(() => {
      this.processQueue().catch(error => {
        console.error('❌ Erro ao processar fila:', error);
      });
    }, this.PROCESSING_INTERVAL_MS);
  }

  /**
   * Stop processing the queue
   */
  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('⏹️ Message queue processing stopped');
    }
  }

  /**
   * Process pending messages in the queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // Get WhatsApp settings first
      const settings = await prisma.whatsAppSettings.findFirst();
      
      // Check if WhatsApp is enabled
      if (!settings?.enabled) {
        console.log('⚠️ WhatsApp está desabilitado, pulando processamento da fila');
        return;
      }

      // Check if WhatsApp is ready
      const connectionStatus = await whatsAppService.getConnectionStatus();
      if (!connectionStatus.isReady) {
        console.log('⚠️ WhatsApp não está pronto, pulando processamento da fila');
        return;
      }

      // Get rate limit settings
      const rateLimitMs = (settings?.rateLimitSeconds || 30) * 1000;

      // Check if we need to respect rate limiting
      const lastMessage = await prisma.whatsAppMessage.findFirst({
        where: {
          deliveryStatus: 'sent'
        },
        orderBy: { sentAt: 'desc' }
      });

      if (lastMessage?.sentAt) {
        const timeSinceLastMessage = Date.now() - lastMessage.sentAt.getTime();
        if (timeSinceLastMessage < rateLimitMs) {
          console.log(`⏳ Rate limit active, waiting ${Math.ceil((rateLimitMs - timeSinceLastMessage) / 1000)}s`);
          return;
        }
      }

      // Get next message to process
      const nextMessage = await this.getNextMessage();
      if (!nextMessage) {
        return;
      }

      // Process the message
      await this.processMessage(nextMessage);

    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get the next message to process from the queue
   */
  private async getNextMessage(): Promise<any | null> {
    const now = new Date();

    return await prisma.messageQueue.findFirst({
      where: {
        status: 'pending',
        scheduledFor: { lte: now },
        attempts: { lt: prisma.messageQueue.fields.maxAttempts }
      },
      orderBy: [
        { priority: 'asc' },
        { scheduledFor: 'asc' },
        { createdAt: 'asc' }
      ]
    });
  }

  /**
   * Process a single message
   */
  private async processMessage(queueEntry: any): Promise<void> {
    try {
      console.log(`📤 Processing message ${queueEntry.id} to ${queueEntry.recipientPhone}`);

      // Mark as processing
      await prisma.messageQueue.update({
        where: { id: queueEntry.id },
        data: {
          status: 'processing',
          lastAttemptAt: new Date(),
          attempts: { increment: 1 }
        }
      });

      // Send the message
      const result = await whatsAppService.sendMessage({
        to: queueEntry.recipientPhone,
        message: queueEntry.messageText
      });

      if (result.success) {
        // Mark as sent
        await prisma.messageQueue.update({
          where: { id: queueEntry.id },
          data: {
            status: 'sent',
            sentAt: new Date()
          }
        });

        console.log(`✅ Message ${queueEntry.id} sent successfully`);
      } else {
        // Handle failure
        await this.handleMessageFailure(queueEntry, result.error || 'Erro desconhecido');
      }

    } catch (error) {
      console.error(`❌ Erro ao processar mensagem ${queueEntry.id}:`, error);
      await this.handleMessageFailure(queueEntry, error instanceof Error ? error.message : 'Erro desconhecido');
    }
  }

  /**
   * Handle message sending failure
   */
  private async handleMessageFailure(queueEntry: any, errorMessage: string): Promise<void> {
    const shouldRetry = queueEntry.attempts < queueEntry.maxAttempts;

    if (shouldRetry) {
      // Calculate retry delay (exponential backoff)
      const retryDelay = Math.min(
        Math.pow(2, queueEntry.attempts) * 1000, // Exponential backoff
        this.MAX_RETRY_DELAY_MS
      );

      const nextAttempt = new Date(Date.now() + retryDelay);

      await prisma.messageQueue.update({
        where: { id: queueEntry.id },
        data: {
          status: 'pending',
          scheduledFor: nextAttempt,
          errorMessage
        }
      });

      console.log(`🔄 Message ${queueEntry.id} scheduled for retry in ${retryDelay / 1000}s`);
    } else {
      // Mark as failed
      await prisma.messageQueue.update({
        where: { id: queueEntry.id },
        data: {
          status: 'failed',
          errorMessage
        }
      });

      console.log(`❌ Message ${queueEntry.id} failed permanently after ${queueEntry.attempts} attempts`);
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    total: number;
  }> {
    const [pending, processing, sent, failed, total] = await Promise.all([
      prisma.messageQueue.count({ where: { status: 'pending' } }),
      prisma.messageQueue.count({ where: { status: 'processing' } }),
      prisma.messageQueue.count({ where: { status: 'sent' } }),
      prisma.messageQueue.count({ where: { status: 'failed' } }),
      prisma.messageQueue.count()
    ]);

    return { pending, processing, sent, failed, total };
  }

  /**
   * Cancel a queued message
   */
  async cancelMessage(messageId: string): Promise<boolean> {
    try {
      const result = await prisma.messageQueue.updateMany({
        where: {
          id: messageId,
          status: { in: ['pending', 'processing'] }
        },
        data: {
          status: 'cancelled'
        }
      });

      return result.count > 0;
    } catch (error) {
      console.error('❌ Erro ao cancelar mensagem:', error);
      return false;
    }
  }

  /**
   * Clear old messages from the queue
   */
  async cleanupOldMessages(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await prisma.messageQueue.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
          status: { in: ['sent', 'failed', 'cancelled'] }
        }
      });

      console.log(`🧹 Limpou ${result.count} mensagens antigas da fila`);
      return result.count;
    } catch (error) {
      console.error('❌ Erro ao limpar mensagens antigas:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const messageQueue = MessageQueue.getInstance();
