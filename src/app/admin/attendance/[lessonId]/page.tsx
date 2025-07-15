'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, ArrowLeft, Clock, Users, UserCheck, UserX, RotateCcw, Camera, CameraOff, User, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, use } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { FaceRecognition } from '@/components/FaceRecognition';

interface Student {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  faceDescriptor?: string;
}

interface Enrollment {
  student: Student;
}

interface Class {
  id: string;
  name: string;
  course: {
    id: string;
    name: string;
  };
  enrollments: Enrollment[];
}

interface Attendance {
  id: string;
  status: 'present' | 'absent' | 'makeup';
  student: Student;
}

interface Lesson {
  id: string;
  title: string;
  description?: string;
  scheduledDate: string;
  duration?: number;
  location?: string;
  isCompleted: boolean;
  class: Class;
  attendance: Attendance[];
}

interface AttendanceRecord {
  studentId: string;
  status: 'present' | 'absent' | 'makeup';
}

export default function AttendanceMarking({ params }: { params: Promise<{ lessonId: string }> }) {
  const resolvedParams = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, 'present' | 'absent' | 'makeup'>>({});
  const [faceRecognitionActive, setFaceRecognitionActive] = useState(false);
  const [recognizedStudents, setRecognizedStudents] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!loading && (!user || !['admin', 'super_admin'].includes(user.profile?.role || ''))) {
      router.push('/');
      return;
    }

    if (user && ['admin', 'super_admin'].includes(user.profile?.role || '')) {
      loadLesson();
    }
  }, [user, loading, router]);

  const loadLesson = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        toast.error('Sessão expirada. Faça login novamente.');
        router.push('/login');
        return;
      }

      const response = await fetch(`/api/lessons/${resolvedParams.lessonId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Falha ao carregar aula');
      }

      const result = await response.json();
      const lessonData = result.data;
      setLesson(lessonData);

      // Initialize attendance records
      const records: Record<string, 'present' | 'absent' | 'makeup'> = {};
      
      // Set existing attendance
      lessonData.attendance.forEach((att: Attendance) => {
        records[att.student.id] = att.status;
      });

      // Set default status for students without attendance
      lessonData.class.enrollments.forEach((enrollment: Enrollment) => {
        if (!records[enrollment.student.id]) {
          records[enrollment.student.id] = 'absent';
        }
      });

      setAttendanceRecords(records);

      // Auto-start face recognition if students have face data
      const studentsWithFaceData = lessonData.class.enrollments.filter(
        (enrollment: Enrollment) => enrollment.student.faceDescriptor
      );

      if (studentsWithFaceData.length > 0) {
        setFaceRecognitionActive(true);
        toast.info(`${studentsWithFaceData.length} alunos com dados faciais encontrados. Reconhecimento iniciado automaticamente.`);
      }
    } catch (error) {
      console.error('Error loading lesson:', error);
      toast.error('Erro ao carregar aula');
    } finally {
      setIsLoading(false);
    }
  };

  const updateAttendance = async (studentId: string, status: 'present' | 'absent' | 'makeup') => {
    // Update local state immediately for UI responsiveness
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: status
    }));

    // Auto-save to server
    await autoSaveAttendance(studentId, status);
  };

  const autoSaveAttendance = async (studentId: string, status: 'present' | 'absent' | 'makeup') => {
    if (!lesson) return;

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        toast.error('Sessão expirada. Faça login novamente.');
        router.push('/login');
        return;
      }

      // Create attendance record for this specific student
      const attendanceData = [{
        studentId,
        status
      }];

      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          lessonId: lesson.id,
          attendance: attendanceData
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao salvar presença');
      }

      // Show success feedback
      const student = lesson.class.enrollments.find(e => e.student.id === studentId)?.student;
      const statusText = status === 'present' ? 'Presente' : status === 'absent' ? 'Ausente' : 'Reposição';
      toast.success(`${student?.name}: ${statusText} salvo automaticamente`);

    } catch (error) {
      console.error('Error auto-saving attendance:', error);
      toast.error('Erro ao salvar presença automaticamente');

      // Revert the local state change on error
      setAttendanceRecords(prev => {
        const reverted = { ...prev };
        // Find the original status from lesson data
        const originalAttendance = lesson.attendance.find(a => a.student.id === studentId);
        if (originalAttendance) {
          reverted[studentId] = originalAttendance.status;
        } else {
          reverted[studentId] = 'absent'; // default
        }
        return reverted;
      });
    }
  };

  const handleStudentRecognized = async (studentId: string, confidence: number) => {
    if (!lesson) return;

    // Use the new auto-save system
    await updateAttendance(studentId, 'present');

    // Add to recognized students set
    setRecognizedStudents(prev => new Set(prev).add(studentId));

    // Show success message with confidence
    const student = lesson.class.enrollments.find(e => e.student.id === studentId)?.student;
    if (student) {
      toast.success(`${student.name} reconhecido automaticamente (${Math.round(confidence * 100)}% confiança)`);
    }
  };

  const toggleFaceRecognition = () => {
    setFaceRecognitionActive(!faceRecognitionActive);
    if (faceRecognitionActive) {
      setRecognizedStudents(new Set());
    }
  };



  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto animate-spin" size={48} />
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user || !['admin', 'super_admin'].includes(user.profile?.role || '')) {
    return null;
  }

  if (!lesson) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="text-center py-8">
              <h3 className="text-lg font-semibold mb-2">Aula não encontrada</h3>
              <p className="text-muted-foreground mb-4">
                A aula solicitada não foi encontrada.
              </p>
              <Button onClick={() => router.push('/admin/attendance')}>
                Voltar para Controle de Presença
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const getStatusCounts = () => {
    const present = Object.values(attendanceRecords).filter(status => status === 'present').length;
    const absent = Object.values(attendanceRecords).filter(status => status === 'absent').length;
    const makeup = Object.values(attendanceRecords).filter(status => status === 'makeup').length;
    return { present, absent, makeup };
  };

  const statusCounts = getStatusCounts();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full" data-testid="attendance-marking">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <Button onClick={() => router.push('/admin/attendance')} variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <CheckSquare className="w-8 h-8 mr-3" />
              Marcar Presença
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={toggleFaceRecognition}
              variant={faceRecognitionActive ? "default" : "outline"}
              size="sm"
              className={faceRecognitionActive ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {faceRecognitionActive ? (
                <>
                  <CameraOff className="w-4 h-4 mr-2" />
                  Parar Reconhecimento
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-2" />
                  Reconhecimento Facial
                </>
              )}
            </Button>

            <Badge variant="outline" className="text-green-600">
              <UserCheck className="w-3 h-3 mr-1" />
              {statusCounts.present} presentes
            </Badge>
            <Badge variant="outline" className="text-red-600">
              <UserX className="w-3 h-3 mr-1" />
              {statusCounts.absent} ausentes
            </Badge>
            {statusCounts.makeup > 0 && (
              <Badge variant="outline" className="text-blue-600">
                <RotateCcw className="w-3 h-3 mr-1" />
                {statusCounts.makeup} reposição
              </Badge>
            )}

            <Badge variant="outline" className="text-purple-600">
              <User className="w-3 h-3 mr-1" />
              {lesson.class.enrollments.filter(e => e.student.faceDescriptor).length} com face
            </Badge>

            {faceRecognitionActive && (
              <Badge variant="outline" className="text-green-600 animate-pulse">
                <Camera className="w-3 h-3 mr-1" />
                Reconhecimento ativo
              </Badge>
            )}
          </div>
        </div>

        {/* Lesson Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              {lesson.title}
            </CardTitle>
            <CardDescription>
              {lesson.class.course.name} • {lesson.class.name} • {formatDateTime(lesson.scheduledDate)}
            </CardDescription>
          </CardHeader>
          {lesson.description && (
            <CardContent>
              <p className="text-muted-foreground">{lesson.description}</p>
            </CardContent>
          )}
        </Card>

        {/* Face Recognition */}
        {faceRecognitionActive && (
          <Card className="mb-6" data-testid="face-recognition-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Camera className="w-5 h-5 mr-2" />
                  Reconhecimento Facial Ativo
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-green-600">Detectando rostos...</span>
                </div>
              </CardTitle>
              <CardDescription>
                Posicione os alunos na frente da câmera. Presença será marcada automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FaceRecognition
                students={lesson.class.enrollments.map(e => e.student)}
                onStudentRecognized={handleStudentRecognized}
                onError={(error) => toast.error(error)}
                isActive={faceRecognitionActive}
                attendanceRecords={attendanceRecords}
              />
            </CardContent>
          </Card>
        )}

        {/* Attendance List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Lista de Presença
            </CardTitle>
            <CardDescription>
              {lesson.class.enrollments.length} alunos matriculados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lesson.class.enrollments.map((enrollment) => {
                const student = enrollment.student;
                const currentStatus = attendanceRecords[student.id] || 'absent';

                return (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium">{student.name}</h4>
                        {recognizedStudents.has(student.id) && (
                          <Badge variant="outline" className="text-green-600 text-xs">
                            <Camera className="w-3 h-3 mr-1" />
                            Reconhecido
                          </Badge>
                        )}
                        {student.faceDescriptor && (
                          <Badge
                            variant="outline"
                            className="text-blue-600 text-xs cursor-help"
                            title="Dados faciais cadastrados - pode ser reconhecido automaticamente"
                          >
                            <User className="w-3 h-3 mr-1" />
                            Face cadastrada
                          </Badge>
                        )}
                      </div>
                      {(student.email || student.phone) && (
                        <p className="text-sm text-muted-foreground">
                          {student.email} {student.email && student.phone && '•'} {student.phone}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button
                        variant={currentStatus === 'present' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateAttendance(student.id, 'present')}
                        className={currentStatus === 'present' ? 'bg-green-600 hover:bg-green-700' : ''}
                      >
                        <UserCheck className="w-4 h-4 mr-1" />
                        Presente
                      </Button>
                      <Button
                        variant={currentStatus === 'absent' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateAttendance(student.id, 'absent')}
                        className={currentStatus === 'absent' ? 'bg-red-600 hover:bg-red-700' : ''}
                      >
                        <UserX className="w-4 h-4 mr-1" />
                        Ausente
                      </Button>
                      <Button
                        variant={currentStatus === 'makeup' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateAttendance(student.id, 'makeup')}
                        className={currentStatus === 'makeup' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Reposição
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end space-x-4 mt-6 pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => router.push('/admin/attendance')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <div className="flex items-center text-sm text-green-600">
                <Check className="w-4 h-4 mr-1" />
                Salvamento automático ativo
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
