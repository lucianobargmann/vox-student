import { prisma } from './prisma';
import { sendWhatsAppReminder } from './whatsapp';
import { TemplateProcessor } from './template-processor';

export interface ReminderJob {
  id: string;
  lessonId: string;
  studentId: string;
  templateId: string;
  scheduledFor: Date;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  attempts: number;
  lastAttempt?: Date;
  errorMessage?: string;
}

export class ReminderService {
  private static readonly MAX_ATTEMPTS = 3;
  private static readonly RETRY_DELAY_MINUTES = 5;

  /**
   * Schedule reminders for upcoming lessons
   */
  static async scheduleReminders(hoursBeforeClass: number = 24): Promise<void> {
    try {
      console.log(`🔔 Scheduling reminders for lessons ${hoursBeforeClass} hours ahead...`);

      // Calculate the time window for lessons to remind about
      const now = new Date();
      const reminderTime = new Date(now.getTime() + hoursBeforeClass * 60 * 60 * 1000);
      const windowStart = new Date(reminderTime.getTime() - 30 * 60 * 1000); // 30 min before
      const windowEnd = new Date(reminderTime.getTime() + 30 * 60 * 1000); // 30 min after

      // Find lessons in the reminder window
      const upcomingLessons = await prisma.lesson.findMany({
        where: {
          scheduledDate: {
            gte: windowStart,
            lte: windowEnd
          },
          status: 'scheduled'
        },
        include: {
          class: {
            include: {
              course: true,
              enrollments: {
                where: {
                  status: 'active'
                },
                include: {
                  student: true
                }
              }
            }
          }
        }
      });

      console.log(`📚 Found ${upcomingLessons.length} lessons to process for reminders`);

      for (const lesson of upcomingLessons) {
        await this.processLessonReminders(lesson, hoursBeforeClass);
      }

      console.log('✅ Reminder scheduling completed');
    } catch (error) {
      console.error('❌ Error scheduling reminders:', error);
      throw error;
    }
  }

  /**
   * Process reminders for a specific lesson
   */
  private static async processLessonReminders(lesson: any, hoursBeforeClass: number): Promise<void> {
    try {
      // Get active reminder template for classes
      const template = await prisma.reminderTemplate.findFirst({
        where: {
          type: 'aula',
          isActive: true
        }
      });

      if (!template) {
        console.log('⚠️ No active reminder template found for classes');
        return;
      }

      // Check WhatsApp settings
      const whatsappSettings = await prisma.whatsAppSettings.findFirst();
      if (!whatsappSettings?.enabled) {
        console.log('⚠️ WhatsApp is not enabled, skipping reminders');
        return;
      }

      console.log(`📝 Processing reminders for lesson: ${lesson.title || 'Untitled'} (${lesson.class.name})`);

      // Process each enrolled student
      for (const enrollment of lesson.class.enrollments) {
        const student = enrollment.student;

        // Skip if student doesn't have a phone number
        if (!student.phone) {
          console.log(`⚠️ Student ${student.name} has no phone number, skipping reminder`);
          continue;
        }

        // Check if reminder already exists for this lesson and student
        const existingReminder = await prisma.whatsAppMessage.findFirst({
          where: {
            recipientPhone: student.phone,
            messageType: 'aula',
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          }
        });

        if (existingReminder) {
          console.log(`⚠️ Reminder already sent to ${student.name} for this lesson`);
          continue;
        }

        // Create template context
        const context = await TemplateProcessor.createTemplateContext({
          studentId: student.id,
          classId: lesson.classId,
          lessonId: lesson.id,
          courseId: lesson.class.course.id
        });

        // Process the template
        const processedTemplate = TemplateProcessor.processTemplate(template.template, context);

        // Send the reminder
        try {
          const result = await sendWhatsAppReminder(
            student.phone,
            processedTemplate.message,
            {
              student_name: student.name,
              class_name: lesson.class.name,
              lesson_date: lesson.scheduledDate.toLocaleDateString('pt-BR'),
              lesson_time: lesson.startTime,
              course_name: lesson.class.course.name
            }
          );

          if (result.success) {
            console.log(`✅ Reminder sent to ${student.name} (${student.phone})`);
            
            // Log successful reminder
            await this.logReminderActivity({
              studentId: student.id,
              lessonId: lesson.id,
              templateId: template.id,
              status: 'sent',
              messageId: result.messageId
            });
          } else {
            console.error(`❌ Falha ao enviar lembrete para ${student.name}: ${result.error}`);
            
            // Log failed reminder
            await this.logReminderActivity({
              studentId: student.id,
              lessonId: lesson.id,
              templateId: template.id,
              status: 'failed',
              errorMessage: result.error
            });
          }
        } catch (error) {
          console.error(`❌ Error sending reminder to ${student.name}:`, error);
          
          // Log error
          await this.logReminderActivity({
            studentId: student.id,
            lessonId: lesson.id,
            templateId: template.id,
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          });
        }

        // Add delay between messages to respect rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
    } catch (error) {
      console.error('❌ Error processing lesson reminders:', error);
      throw error;
    }
  }

  /**
   * Send makeup class reminders
   */
  static async sendMakeupReminders(classId: string, makeupDate: Date): Promise<void> {
    try {
      console.log(`🔄 Sending makeup class reminders for class ${classId}`);

      // Get class with enrollments
      const classData = await prisma.class.findUnique({
        where: { id: classId },
        include: {
          course: true,
          enrollments: {
            where: { status: 'active' },
            include: { student: true }
          }
        }
      });

      if (!classData) {
        throw new Error('Class not found');
      }

      // Get makeup reminder template
      const template = await prisma.reminderTemplate.findFirst({
        where: {
          type: 'reposicao',
          isActive: true
        }
      });

      if (!template) {
        throw new Error('No active makeup reminder template found');
      }

      // Send reminders to all enrolled students
      for (const enrollment of classData.enrollments) {
        const student = enrollment.student;

        if (!student.phone) {
          console.log(`⚠️ Student ${student.name} has no phone number, skipping makeup reminder`);
          continue;
        }

        // Create template context
        const context = await TemplateProcessor.createTemplateContext({
          studentId: student.id,
          classId: classData.id,
          courseId: classData.course.id
        });

        // Add makeup-specific context
        context.lesson = {
          id: 'makeup',
          scheduledDate: makeupDate,
          startTime: classData.startTime,
          endTime: classData.endTime,
          title: 'Aula de Reposição'
        };

        // Process template
        const processedTemplate = TemplateProcessor.processTemplate(template.template, context);

        // Send reminder
        const result = await sendWhatsAppReminder(student.phone, processedTemplate.message);

        if (result.success) {
          console.log(`✅ Lembrete de reposição enviado para ${student.name}`);
        } else {
          console.error(`❌ Falha ao enviar lembrete de reposição para ${student.name}: ${result.error}`);
        }

        // Add delay between messages
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log('✅ Makeup reminders completed');
    } catch (error) {
      console.error('❌ Error sending makeup reminders:', error);
      throw error;
    }
  }

  /**
   * Log reminder activity
   */
  private static async logReminderActivity(data: {
    studentId: string;
    lessonId: string;
    templateId: string;
    status: 'sent' | 'failed';
    messageId?: string;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: 'system',
          action: 'SEND_REMINDER',
          tableName: 'whatsapp_messages',
          recordId: data.messageId || 'unknown',
          newValues: JSON.stringify({
            studentId: data.studentId,
            lessonId: data.lessonId,
            templateId: data.templateId,
            status: data.status,
            errorMessage: data.errorMessage
          })
        }
      });
    } catch (error) {
      console.error('❌ Error logging reminder activity:', error);
    }
  }

  /**
   * Get reminder statistics
   */
  static async getReminderStatistics(days: number = 7): Promise<{
    totalReminders: number;
    sentReminders: number;
    failedReminders: number;
    successRate: string;
  }> {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const [totalReminders, sentReminders, failedReminders] = await Promise.all([
      prisma.whatsAppMessage.count({
        where: {
          messageType: { in: ['aula', 'reposicao', 'mentoria'] },
          createdAt: { gte: dateFrom }
        }
      }),
      prisma.whatsAppMessage.count({
        where: {
          messageType: { in: ['aula', 'reposicao', 'mentoria'] },
          deliveryStatus: 'sent',
          createdAt: { gte: dateFrom }
        }
      }),
      prisma.whatsAppMessage.count({
        where: {
          messageType: { in: ['aula', 'reposicao', 'mentoria'] },
          deliveryStatus: 'failed',
          createdAt: { gte: dateFrom }
        }
      })
    ]);

    const successRate = totalReminders > 0 
      ? ((sentReminders / totalReminders) * 100).toFixed(1)
      : '0';

    return {
      totalReminders,
      sentReminders,
      failedReminders,
      successRate
    };
  }
}
