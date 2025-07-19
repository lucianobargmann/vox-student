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
    const { template, category, contextOptions } = body;

    if (!template || !template.trim()) {
      return NextResponse.json(
        { error: 'Template é obrigatório' },
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

    if (!context.class && (category === 'aula' || category === 'reposicao')) {
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

    // Get available variables for this category
    const availableVariables = TemplateProcessor.getAvailableVariables(category);

    return NextResponse.json({
      success: true,
      processed: {
        message: processed.message,
        usedPlaceholders: processed.placeholders
      },
      availableVariables,
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
    const category = searchParams.get('category');

    const availableVariables = TemplateProcessor.getAvailableVariables(category || undefined);

    // Group variables by type
    const groupedVariables = {
      aluno: availableVariables.filter(v => v.name.includes('aluno')),
      aula: availableVariables.filter(v => v.name.includes('aula')),
      curso: availableVariables.filter(v => v.name.includes('curso')),
      professor: availableVariables.filter(v => v.name.includes('professor')),
      sistema: availableVariables.filter(v => v.name.includes('sistema'))
    };

    return NextResponse.json({
      category,
      variables: availableVariables,
      groupedVariables,
      examples: {
        'nome_do_aluno': 'João Silva',
        'email_do_aluno': 'joao.silva@email.com',
        'telefone_do_aluno': '+55 11 99999-9999',
        'nome_aula': 'Inglês Intermediário - Turma A',
        'hora_inicio_aula': '19:00',
        'hora_fim_aula': '20:30',
        'data_aula': '15/07/2025 19:00',
        'titulo_aula': 'Present Perfect Tense',
        'nome_curso': 'Curso de Inglês Intermediário',
        'nome_professor': 'Prof. Maria Santos',
        'nome_sistema': 'VoxStudent',
        'url_sistema': 'https://voxstudent.com'
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
