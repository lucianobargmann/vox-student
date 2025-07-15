import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyAuth } from '@/lib/auth';
import { TemplateProcessor } from '@/lib/template-processor';

const prisma = new PrismaClient();

// GET /api/reminder-templates - List all reminder templates
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    let whereClause = {};
    if (type) {
      whereClause = { type };
    }

    const templates = await prisma.reminderTemplate.findMany({
      where: whereClause,
      orderBy: { name: 'asc' }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_access',
        severity: 'low',
        description: `User accessed reminder templates list`,
        metadata: JSON.stringify({ type }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ data: templates });
  } catch (error) {
    console.error('Get reminder templates error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST /api/reminder-templates - Create a new reminder template
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, template } = body;

    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Nome do template é obrigatório (mínimo 2 caracteres)' },
        { status: 400 }
      );
    }

    if (!type || !['aula', 'mentoria', 'reposicao'].includes(type)) {
      return NextResponse.json(
        { error: 'Tipo de lembrete inválido' },
        { status: 400 }
      );
    }

    if (!template || template.trim().length < 10) {
      return NextResponse.json(
        { error: 'Template de mensagem é obrigatório (mínimo 10 caracteres)' },
        { status: 400 }
      );
    }

    // Validate template syntax
    const validation = TemplateProcessor.validateTemplate(template.trim());
    if (!validation.isValid) {
      return NextResponse.json(
        { error: `Template inválido: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
    }

    const reminderTemplate = await prisma.reminderTemplate.create({
      data: {
        name: name.trim(),
        type,
        template: template.trim()
      }
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'CREATE',
        tableName: 'reminder_templates',
        recordId: reminderTemplate.id,
        newValues: JSON.stringify(reminderTemplate)
      }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_modification',
        severity: 'low',
        description: `User created reminder template: ${reminderTemplate.name}`,
        metadata: JSON.stringify({ templateId: reminderTemplate.id }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ data: reminderTemplate }, { status: 201 });
  } catch (error) {
    console.error('Create reminder template error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
