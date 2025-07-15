import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// POST /api/face-recognition/identify - Identify student by face descriptor
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { faceDescriptor, lessonId, threshold = 0.6 } = await request.json();

    if (!faceDescriptor || !lessonId) {
      return NextResponse.json(
        { error: 'Face descriptor e lesson ID são obrigatórios' },
        { status: 400 }
      );
    }

    // Verify lesson exists and get enrolled students
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        class: {
          include: {
            enrollments: {
              where: { status: 'active' },
              include: {
                student: {
                  select: {
                    id: true,
                    name: true,
                    faceDescriptor: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Aula não encontrada' }, { status: 404 });
    }

    // Get students with face data
    const studentsWithFaceData = lesson.class.enrollments
      .map(enrollment => enrollment.student)
      .filter(student => student.faceDescriptor);

    if (studentsWithFaceData.length === 0) {
      return NextResponse.json({
        data: null,
        message: 'Nenhum aluno desta turma possui dados faciais cadastrados'
      });
    }

    // Convert input face descriptor to Float32Array
    const inputDescriptor = new Float32Array(faceDescriptor);
    
    let bestMatch: { studentId: string; studentName: string; distance: number } | null = null;

    // Compare with each student's face descriptor
    for (const student of studentsWithFaceData) {
      try {
        const storedDescriptorArray = JSON.parse(student.faceDescriptor!);
        const storedDescriptor = new Float32Array(storedDescriptorArray);
        
        // Calculate Euclidean distance
        const distance = euclideanDistance(inputDescriptor, storedDescriptor);
        
        if (distance < threshold && (!bestMatch || distance < bestMatch.distance)) {
          bestMatch = {
            studentId: student.id,
            studentName: student.name,
            distance
          };
        }
      } catch (error) {
        console.error(`Error processing face data for student ${student.id}:`, error);
      }
    }

    if (!bestMatch) {
      return NextResponse.json({
        data: null,
        message: 'Nenhum aluno reconhecido'
      });
    }

    const confidence = 1 - bestMatch.distance;

    // Log recognition attempt
    await prisma.securityEvent.create({
      data: {
        userId: authResult.user.id,
        eventType: 'face_recognition_attempt',
        severity: 'low',
        description: `Face recognition attempt for lesson: ${lesson.title}`,
        metadata: JSON.stringify({
          lessonId,
          recognizedStudentId: bestMatch.studentId,
          recognizedStudentName: bestMatch.studentName,
          confidence: Math.round(confidence * 100),
          distance: bestMatch.distance
        }),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown'
      }
    });

    return NextResponse.json({
      data: {
        studentId: bestMatch.studentId,
        studentName: bestMatch.studentName,
        confidence: Math.round(confidence * 100),
        distance: bestMatch.distance
      },
      message: `Aluno ${bestMatch.studentName} reconhecido com ${Math.round(confidence * 100)}% de confiança`
    });
  } catch (error) {
    console.error('Face recognition error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// Helper function to calculate Euclidean distance between two face descriptors
function euclideanDistance(descriptor1: Float32Array, descriptor2: Float32Array): number {
  if (descriptor1.length !== descriptor2.length) {
    throw new Error('Face descriptors must have the same length');
  }

  let sum = 0;
  for (let i = 0; i < descriptor1.length; i++) {
    const diff = descriptor1[i] - descriptor2[i];
    sum += diff * diff;
  }
  
  return Math.sqrt(sum);
}
