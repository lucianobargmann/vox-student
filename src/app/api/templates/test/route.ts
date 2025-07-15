import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { TemplateProcessor } from '@/lib/template-processor';

// POST /api/templates/test - Test a template with sample data
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { template, templateType, contextOptions } = body;

    if (!template || !template.trim()) {
      return NextResponse.json(
        { error: 'Template é obrigatório' },
        { status: 400 }
      );
    }

    if (!templateType || !['aula', 'mentoria', 'reposicao'].includes(templateType)) {
      return NextResponse.json(
        { error: 'Tipo de template inválido' },
        { status: 400 }
      );
    }

    // Validate template syntax
    const validation = TemplateProcessor.validateTemplate(template);
    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        errors: validation.errors
      }, { status: 400 });
    }

    // Create template context
    const context = await TemplateProcessor.createTemplateContext(contextOptions || {});

    // Add sample data if no real data is provided
    if (!context.student) {
      context.student = {
        id: 'sample-student-id',
        name: 'João Silva',
        email: 'joao.silva@email.com',
        phone: '+55 11 99999-9999'
      };
    }

    if (!context.class && (templateType === 'aula' || templateType === 'reposicao')) {
      context.class = {
        id: 'sample-class-id',
        name: 'Inglês Intermediário - Turma A',
        startTime: '19:00',
        endTime: '20:30',
        dayOfWeek: 'monday'
      };
    }

    if (!context.course) {
      context.course = {
        id: 'sample-course-id',
        name: 'Curso de Inglês Intermediário',
        description: 'Curso focado em conversação e gramática intermediária'
      };
    }

    if (!context.lesson) {
      context.lesson = {
        id: 'sample-lesson-id',
        title: 'Present Perfect Tense',
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        startTime: '19:00',
        endTime: '20:30'
      };
    }

    if (!context.teacher) {
      context.teacher = {
        name: 'Prof. Maria Santos',
        email: 'maria.santos@voxstudent.com',
        phone: '+55 11 88888-8888'
      };
    }

    // Process the template
    const processed = TemplateProcessor.processTemplate(template, context);

    // Get available placeholders for this template type
    const availablePlaceholders = TemplateProcessor.getAvailablePlaceholders(templateType);

    return NextResponse.json({
      success: true,
      processed: {
        message: processed.message,
        usedPlaceholders: processed.placeholders
      },
      availablePlaceholders,
      sampleContext: context
    });

  } catch (error) {
    console.error('❌ Error testing template:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// GET /api/templates/test - Get available placeholders for a template type
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const templateType = searchParams.get('type') as 'aula' | 'mentoria' | 'reposicao';

    if (!templateType || !['aula', 'mentoria', 'reposicao'].includes(templateType)) {
      return NextResponse.json(
        { error: 'Tipo de template inválido' },
        { status: 400 }
      );
    }

    const availablePlaceholders = TemplateProcessor.getAvailablePlaceholders(templateType);

    // Group placeholders by category
    const groupedPlaceholders = {
      student: availablePlaceholders.filter(p => p.startsWith('student.')),
      class: availablePlaceholders.filter(p => p.startsWith('class.')),
      lesson: availablePlaceholders.filter(p => p.startsWith('lesson.')),
      course: availablePlaceholders.filter(p => p.startsWith('course.')),
      teacher: availablePlaceholders.filter(p => p.startsWith('teacher.')),
      system: availablePlaceholders.filter(p => p.startsWith('system.'))
    };

    return NextResponse.json({
      templateType,
      placeholders: availablePlaceholders,
      groupedPlaceholders,
      examples: {
        'student.name': 'João Silva',
        'student.email': 'joao.silva@email.com',
        'student.phone': '+55 11 99999-9999',
        'class.name': 'Inglês Intermediário - Turma A',
        'class.startTime': '19:00',
        'class.endTime': '20:30',
        'lesson.scheduledDate': '15/07/2025 19:00',
        'lesson.title': 'Present Perfect Tense',
        'course.name': 'Curso de Inglês Intermediário',
        'teacher.name': 'Prof. Maria Santos',
        'system.name': 'VoxStudent',
        'system.url': 'https://voxstudent.com'
      }
    });

  } catch (error) {
    console.error('❌ Error getting template placeholders:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
