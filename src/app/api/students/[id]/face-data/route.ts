import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// POST /api/students/[id]/face-data - Save face data for student
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const resolvedParams = await params;
    const { faceDescriptor, photoUrl } = await request.json();

    if (!faceDescriptor) {
      return NextResponse.json(
        { error: 'Face descriptor é obrigatório' },
        { status: 400 }
      );
    }

    // Verify student exists
    const student = await prisma.student.findUnique({
      where: { id: resolvedParams.id }
    });

    if (!student) {
      return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 });
    }

    // Update student with face data
    const updatedStudent = await prisma.student.update({
      where: { id: resolvedParams.id },
      data: {
        faceDescriptor,
        photoUrl: photoUrl || null,
        faceDataUpdatedAt: new Date()
      }
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'UPDATE',
        tableName: 'students',
        recordId: resolvedParams.id,
        newValues: JSON.stringify({
          faceDescriptor: '[FACE_DATA]', // Don't log actual face data
          photoUrl: photoUrl ? '[PHOTO_DATA]' : null,
          faceDataUpdatedAt: updatedStudent.faceDataUpdatedAt
        })
      }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'face_data_update',
        severity: 'medium',
        description: `Face data updated for student: ${student.name}`,
        metadata: JSON.stringify({ 
          studentId: resolvedParams.id,
          studentName: student.name,
          hasPhotoUrl: !!photoUrl
        }),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({
      data: {
        id: updatedStudent.id,
        faceDataUpdatedAt: updatedStudent.faceDataUpdatedAt
      },
      message: 'Dados faciais salvos com sucesso'
    });
  } catch (error) {
    console.error('Save face data error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE /api/students/[id]/face-data - Remove face data for student
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const resolvedParams = await params;

    // Verify student exists
    const student = await prisma.student.findUnique({
      where: { id: resolvedParams.id }
    });

    if (!student) {
      return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 });
    }

    // Remove face data
    const updatedStudent = await prisma.student.update({
      where: { id: resolvedParams.id },
      data: {
        faceDescriptor: null,
        photoUrl: null,
        faceDataUpdatedAt: null
      }
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: authResult.user.id,
        action: 'UPDATE',
        tableName: 'students',
        recordId: resolvedParams.id,
        newValues: JSON.stringify({
          faceDescriptor: null,
          photoUrl: null,
          faceDataUpdatedAt: null
        })
      }
    });

    // Log security event
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'face_data_removal',
        severity: 'medium',
        description: `Face data removed for student: ${student.name}`,
        metadata: JSON.stringify({ 
          studentId: resolvedParams.id,
          studentName: student.name
        }),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({
      data: { id: updatedStudent.id },
      message: 'Dados faciais removidos com sucesso'
    });
  } catch (error) {
    console.error('Remove face data error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
