import { prisma } from './prisma';

export interface TemplateContext {
  student?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  class?: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    dayOfWeek: string;
  };
  lesson?: {
    id: string;
    title?: string;
    scheduledDate: Date;
    startTime: string;
    endTime: string;
  };
  course?: {
    id: string;
    name: string;
    description?: string;
  };
  teacher?: {
    name: string;
    email?: string;
    phone?: string;
  };
  system?: {
    name: string;
    url: string;
    supportEmail?: string;
    supportPhone?: string;
  };
}

export interface ProcessedTemplate {
  subject?: string;
  message: string;
  placeholders: string[];
}

export class TemplateProcessor {
  private static readonly PLACEHOLDER_REGEX = /\{\{([^}]+)\}\}/g;

  /**
   * Process a template with the given context
   */
  static processTemplate(template: string, context: TemplateContext): ProcessedTemplate {
    const placeholders: string[] = [];
    let processedMessage = template;

    // Find all placeholders in the template
    const matches = template.match(this.PLACEHOLDER_REGEX);
    if (matches) {
      placeholders.push(...matches.map(match => match.slice(2, -2)));
    }

    // Replace placeholders with actual values
    processedMessage = template.replace(this.PLACEHOLDER_REGEX, (match, placeholder) => {
      const value = this.resolvePlaceholder(placeholder.trim(), context);
      return value !== undefined ? String(value) : match;
    });

    return {
      message: processedMessage,
      placeholders: [...new Set(placeholders)] // Remove duplicates
    };
  }

  /**
   * Resolve a placeholder to its actual value
   */
  private static resolvePlaceholder(placeholder: string, context: TemplateContext): any {
    // Handle simplified Portuguese variable names
    const variableMap: Record<string, string> = {
      'nome_do_aluno': 'student.name',
      'email_do_aluno': 'student.email',
      'telefone_do_aluno': 'student.phone',
      'nome_curso': 'course.name',
      'descricao_curso': 'course.description',
      'nome_aula': 'class.name',
      'data_aula': 'lesson.scheduledDate',
      'hora_inicio_aula': 'lesson.startTime',
      'hora_fim_aula': 'lesson.endTime',
      'dia_da_semana': 'class.dayOfWeek',
      'titulo_aula': 'lesson.title',
      'nome_professor': 'teacher.name',
      'email_professor': 'teacher.email',
      'telefone_professor': 'teacher.phone',
      'local_aula': 'class.location',
      'nome_sistema': 'system.name',
      'url_sistema': 'system.url',
      'email_suporte': 'system.supportEmail',
      'telefone_suporte': 'system.supportPhone'
    };

    // Convert simplified variable to dot notation if found
    const actualPlaceholder = variableMap[placeholder] || placeholder;
    const parts = actualPlaceholder.split('.');
    let current: any = context;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }

    // Format dates and times
    if (current instanceof Date) {
      return this.formatDate(current);
    }

    return current;
  }

  /**
   * Format date for Brazilian locale
   */
  private static formatDate(date: Date): string {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Get available variables in Portuguese for the UI
   */
  static getAvailableVariables(category?: string): Array<{name: string, description: string}> {
    const allVariables = [
      { name: 'nome_do_aluno', description: 'Nome do aluno' },
      { name: 'email_do_aluno', description: 'Email do aluno' },
      { name: 'telefone_do_aluno', description: 'Telefone do aluno' },
      { name: 'nome_curso', description: 'Nome do curso' },
      { name: 'descricao_curso', description: 'Descrição do curso' },
      { name: 'nome_aula', description: 'Nome da aula/turma' },
      { name: 'data_aula', description: 'Data da aula' },
      { name: 'hora_inicio_aula', description: 'Hora de início da aula' },
      { name: 'hora_fim_aula', description: 'Hora de fim da aula' },
      { name: 'dia_da_semana', description: 'Dia da semana da aula' },
      { name: 'titulo_aula', description: 'Título da aula' },
      { name: 'nome_professor', description: 'Nome do professor' },
      { name: 'email_professor', description: 'Email do professor' },
      { name: 'telefone_professor', description: 'Telefone do professor' },
      { name: 'local_aula', description: 'Local da aula' },
      { name: 'nome_sistema', description: 'Nome do sistema' },
      { name: 'url_sistema', description: 'URL do sistema' },
      { name: 'email_suporte', description: 'Email de suporte' },
      { name: 'telefone_suporte', description: 'Telefone de suporte' }
    ];

    // Filter by category if specified
    if (category) {
      switch (category.toLowerCase()) {
        case 'aula':
          return allVariables.filter(v => 
            v.name.includes('aluno') || 
            v.name.includes('curso') || 
            v.name.includes('aula') || 
            v.name.includes('professor') ||
            v.name.includes('sistema')
          );
        case 'mentoria':
          return allVariables.filter(v => 
            v.name.includes('aluno') || 
            v.name.includes('professor') ||
            v.name.includes('sistema') ||
            v.name === 'data_aula' ||
            v.name === 'hora_inicio_aula' ||
            v.name === 'hora_fim_aula'
          );
        case 'reposicao':
          return allVariables;
        default:
          return allVariables;
      }
    }

    return allVariables;
  }

  /**
   * Get available placeholders for a template type (legacy)
   */
  static getAvailablePlaceholders(templateType: 'aula' | 'mentoria' | 'reposicao'): string[] {
    return this.getAvailableVariables(templateType).map(v => v.name);
  }

  /**
   * Create template context from database entities
   */
  static async createTemplateContext(options: {
    studentId?: string;
    classId?: string;
    lessonId?: string;
    courseId?: string;
  }): Promise<TemplateContext> {
    const context: TemplateContext = {
      system: {
        name: 'VoxStudent',
        url: process.env.NEXTAUTH_URL || 'http://localhost:3000',
        supportEmail: process.env.SUPPORT_EMAIL || 'suporte@voxstudent.com',
        supportPhone: process.env.SUPPORT_PHONE || '+55 11 99999-9999'
      }
    };

    // Load student data
    if (options.studentId) {
      const student = await prisma.student.findUnique({
        where: { id: options.studentId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true
        }
      });

      if (student) {
        context.student = student;
      }
    }

    // Load class data
    if (options.classId) {
      const classData = await prisma.class.findUnique({
        where: { id: options.classId },
        include: {
          course: {
            select: {
              id: true,
              name: true,
              description: true
            }
          }
        }
      });

      if (classData) {
        context.class = {
          id: classData.id,
          name: classData.name,
          startTime: classData.startTime,
          endTime: classData.endTime,
          dayOfWeek: classData.dayOfWeek
        };

        if (classData.course) {
          context.course = classData.course;
        }
      }
    }

    // Load lesson data
    if (options.lessonId) {
      const lesson = await prisma.lesson.findUnique({
        where: { id: options.lessonId },
        include: {
          class: {
            include: {
              course: {
                select: {
                  id: true,
                  name: true,
                  description: true
                }
              }
            }
          }
        }
      });

      if (lesson) {
        context.lesson = {
          id: lesson.id,
          title: lesson.title,
          scheduledDate: lesson.scheduledDate,
          startTime: lesson.startTime,
          endTime: lesson.endTime
        };

        // Also populate class and course data from lesson
        if (lesson.class && !context.class) {
          context.class = {
            id: lesson.class.id,
            name: lesson.class.name,
            startTime: lesson.class.startTime,
            endTime: lesson.class.endTime,
            dayOfWeek: lesson.class.dayOfWeek
          };

          if (lesson.class.course && !context.course) {
            context.course = lesson.class.course;
          }
        }
      }
    }

    // Load course data
    if (options.courseId && !context.course) {
      const course = await prisma.course.findUnique({
        where: { id: options.courseId },
        select: {
          id: true,
          name: true,
          description: true
        }
      });

      if (course) {
        context.course = course;
      }
    }

    return context;
  }

  /**
   * Validate template syntax
   */
  static validateTemplate(template: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check for unmatched braces
    const openBraces = (template.match(/\{\{/g) || []).length;
    const closeBraces = (template.match(/\}\}/g) || []).length;
    
    if (openBraces !== closeBraces) {
      errors.push('Chaves não balanceadas no template');
    }

    // Check for empty placeholders
    if (template.includes('{{}}')) {
      errors.push('Placeholder vazio encontrado');
    }

    // Check for nested placeholders
    if (template.includes('{{{') || template.includes('}}}')) {
      errors.push('Placeholders aninhados não são suportados');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
