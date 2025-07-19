import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyAuth } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/reminder-templates/[id] - Get a specific reminder template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const template = await prisma.reminderTemplate.findUnique({
      where: { id }
    });

    if (!template) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ data: template });
  } catch (error) {
    console.error('Get reminder template error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PUT /api/reminder-templates/[id] - Update a reminder template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { name, category, template, description, isActive } = body;

    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Nome do template é obrigatório (mínimo 2 caracteres)' },
        { status: 400 }
      );
    }

    if (!template || template.trim().length < 10) {
      return NextResponse.json(
        { error: 'Template de mensagem é obrigatório (mínimo 10 caracteres)' },
        { status: 400 }
      );
    }

    // Get old values for audit
    const oldTemplate = await prisma.reminderTemplate.findUnique({
      where: { id }
    });

    if (!oldTemplate) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 });
    }

    const updatedTemplate = await prisma.reminderTemplate.update({
      where: { id },
      data: {
        name: name.trim(),
        category: category?.trim() || null,
        template: template.trim(),
        description: description?.trim() || null,
        isActive: isActive !== undefined ? isActive : oldTemplate.isActive
      }
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'UPDATE',
        tableName: 'reminder_templates',
        recordId: updatedTemplate.id,
        oldValues: JSON.stringify(oldTemplate),
        newValues: JSON.stringify(updatedTemplate)
      }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_modification',
        severity: 'low',
        description: `User updated reminder template: ${updatedTemplate.name}`,
        metadata: JSON.stringify({ templateId: updatedTemplate.id }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ data: updatedTemplate });
  } catch (error) {
    console.error('Update reminder template error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE /api/reminder-templates/[id] - Delete a reminder template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Get template for audit
    const template = await prisma.reminderTemplate.findUnique({
      where: { id }
    });

    if (!template) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 });
    }

    await prisma.reminderTemplate.delete({
      where: { id }
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'DELETE',
        tableName: 'reminder_templates',
        recordId: id,
        oldValues: JSON.stringify(template)
      }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'data_modification',
        severity: 'medium',
        description: `User deleted reminder template: ${template.name}`,
        metadata: JSON.stringify({ templateId: id }),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('Delete reminder template error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
