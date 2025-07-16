'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckSquare, ArrowLeft, Calendar, Clock, UserCheck, UserX, RotateCcw, Camera, CameraOff, User, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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

export default function AttendanceManagement() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, Record<string, 'present' | 'absent' | 'makeup'>>>({});
  const [faceRecognitionActive, setFaceRecognitionActive] = useState(false);
  const [faceRecognitionManuallyStopped, setFaceRecognitionManuallyStopped] = useState(false);
  const [recognizedStudents, setRecognizedStudents] = useState<Set<string>>(new Set());

  const loadTodaysLessons = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('auth_token');

      if (!token) {
        toast.error('Sessão expirada. Faça login novamente.');
        router.push('/login');
        return;
      }

      const response = await fetch('/api/lessons?today=true', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Falha ao carregar aulas de hoje');
      }

      const result = await response.json();
      const lessonsData = result.data || [];
      setLessons(lessonsData);

      // Initialize attendance records for all lessons
      const initialRecords: Record<string, Record<string, 'present' | 'absent' | 'makeup'>> = {};
      lessonsData.forEach((lesson: Lesson) => {
        initialRecords[lesson.id] = {};
        
        // Set existing attendance
        lesson.attendance.forEach((att) => {
          initialRecords[lesson.id][att.student.id] = att.status;
        });

        // Set default status for students without attendance
        lesson.class.enrollments.forEach((enrollment) => {
          if (!initialRecords[lesson.id][enrollment.student.id]) {
            initialRecords[lesson.id][enrollment.student.id] = 'absent';
          }
        });
      });

      setAttendanceRecords(initialRecords);
    } catch (error) {
      console.error('Error loading today\'s lessons:', error);
      toast.error('Erro ao carregar aulas de hoje');
    } finally {
      setIsLoading(false);
    }
  };

  const updateAttendance = async (lessonId: string, studentId: string, status: 'present' | 'absent' | 'makeup') => {
    // Update local state immediately for UI responsiveness
    setAttendanceRecords(prev => ({
      ...prev,
      [lessonId]: {
        ...prev[lessonId],
        [studentId]: status
      }
    }));

    // Auto-save to server
    await autoSaveAttendance(lessonId, studentId, status);
  };

  const autoSaveAttendance = async (lessonId: string, studentId: string, status: 'present' | 'absent' | 'makeup') => {
    try {
      const token = localStorage.getItem('auth_token');

      if (!token) {
        throw new Error('Token de autenticação não encontrado');
      }

      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          lessonId,
          attendance: [{
            studentId,
            status
          }]
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao salvar presença');
      }


    } catch (error) {
      console.error('Error saving attendance:', error);
      toast.error('Erro ao salvar presença automaticamente');

      // Revert the local state change on error
      setAttendanceRecords(prev => ({
        ...prev,
        [lessonId]: {
          ...prev[lessonId],
          [studentId]: 'absent'
        }
      }));
    }
  };

  const handleStudentRecognized = async (studentId: string, confidence: number) => {
    // Find all lessons where this student is enrolled and mark attendance
    const lessonsToUpdate = lessons.filter((lesson: Lesson) =>
      lesson.class.enrollments.some((enrollment: Enrollment) => enrollment.student.id === studentId) &&
      attendanceRecords[lesson.id]?.[studentId] !== 'present'
    );

    if (lessonsToUpdate.length === 0) {
      // Don't return early - still add to recognized students to show the badge
      setRecognizedStudents(prev => new Set(prev).add(studentId));
      return;
    }

    // Update attendance for all applicable lessons
    for (const lesson of lessonsToUpdate) {
      await updateAttendance(lesson.id, studentId, 'present');
    }

    // Add to recognized students set
    setRecognizedStudents(prev => new Set(prev).add(studentId));

    // Show success message with confidence and number of lessons updated
    const student = lessons
      .flatMap((l: Lesson) => l.class.enrollments)
      .find((e: Enrollment) => e.student.id === studentId)?.student;

    if (student) {
      const lessonNames = lessonsToUpdate.map((l: Lesson) => l.class.name).join(', ');
      toast.success(
        `${student.name} reconhecido automaticamente (${Math.round(confidence * 100)}% confiança) - Presença marcada em: ${lessonNames}`
      );
    }
  };

  const toggleFaceRecognition = () => {
    const newActiveState = !faceRecognitionActive;
    setFaceRecognitionActive(newActiveState);

    if (!newActiveState) {
      // User manually stopped recognition
      setFaceRecognitionManuallyStopped(true);
      setRecognizedStudents(new Set());
    } else {
      // User manually started recognition
      setFaceRecognitionManuallyStopped(false);
    }
  };

  useEffect(() => {
    if (!loading && (!user || !['admin', 'super_admin'].includes(user.profile?.role || ''))) {
      router.push('/');
      return;
    }

    if (user && ['admin', 'super_admin'].includes(user.profile?.role || '')) {
      loadTodaysLessons();
    }
  }, [user, loading]);

  // Auto-start face recognition when lessons are loaded (only if not manually stopped)
  useEffect(() => {
    if (!isLoading && lessons.length > 0 && !faceRecognitionActive && !faceRecognitionManuallyStopped) {
      setFaceRecognitionActive(true);
      toast.success(`Reconhecimento facial iniciado automaticamente para ${lessons.length} turma(s) do dia`);
    }
  }, [lessons, isLoading, faceRecognitionActive, faceRecognitionManuallyStopped]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <Button onClick={() => router.push('/')} variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <CheckSquare className="w-8 h-8 mr-3" />
              Marcar Presença
            </h1>
          </div>
        </div>

        {lessons.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="w-6 h-6 mr-2" />
                Nenhuma aula hoje
              </CardTitle>
              <CardDescription>
                Não há aulas programadas para hoje
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center py-8">
              <Calendar className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Agenda livre</h3>
              <p className="text-muted-foreground">
                Não há aulas programadas para hoje. Verifique a programação das turmas.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Face Recognition Section */}
            <Card className="mb-6" data-testid="face-recognition-card">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column - Controls and Info */}
                  <div className="space-y-4">
                    <div>
                      <CardTitle className="flex items-center text-xl mb-2">
                        <Camera className="w-5 h-5 mr-2" />
                        Reconhecimento Facial
                      </CardTitle>
                      <CardDescription className="text-sm">
                        {faceRecognitionActive
                          ? "Posicione os alunos na frente da câmera. Presença será marcada automaticamente em todas as turmas do dia."
                          : "Clique para iniciar o reconhecimento facial para todas as turmas do dia."
                        }
                      </CardDescription>
                    </div>

                    <Button
                      onClick={toggleFaceRecognition}
                      variant={faceRecognitionActive ? "default" : "outline"}
                      size="lg"
                      className={`w-full ${faceRecognitionActive ? "bg-green-600 hover:bg-green-700" : ""}`}
                    >
                      {faceRecognitionActive ? (
                        <>
                          <CameraOff className="w-5 h-5 mr-2" />
                          Parar Reconhecimento
                        </>
                      ) : (
                        <>
                          <Camera className="w-5 h-5 mr-2" />
                          Iniciar Reconhecimento
                        </>
                      )}
                    </Button>

                    {faceRecognitionActive && (
                      <div className="space-y-3">
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center text-green-700">
                            <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                            <span className="text-sm font-medium">Reconhecimento Ativo</span>
                          </div>
                          <p className="text-xs text-green-600 mt-1">
                            Sistema pronto para detectar rostos
                          </p>
                        </div>

                        {recognizedStudents.size > 0 && (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center text-blue-700 mb-2">
                              <Check className="w-4 h-4 mr-2" />
                              <span className="text-sm font-medium">
                                {recognizedStudents.size} aluno(s) reconhecido(s)
                              </span>
                            </div>
                            <div className="text-xs text-blue-600">
                              Presença marcada automaticamente
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Column - Camera Feed */}
                  <div className="flex items-center justify-center">
                    {faceRecognitionActive ? (
                      <div className="w-full">
                        <FaceRecognition
                          students={lessons.reduce((students: Student[], lesson: Lesson) => {
                            lesson.class.enrollments.forEach((enrollment: Enrollment) => {
                              if (!students.find(s => s.id === enrollment.student.id)) {
                                students.push(enrollment.student);
                              }
                            });
                            return students;
                          }, [])}
                          onStudentRecognized={handleStudentRecognized}
                          onError={(error) => toast.error(error)}
                          isActive={faceRecognitionActive}
                          attendanceRecords={
                            // Flatten attendance records from all lessons for this student
                            lessons.reduce((acc: Record<string, 'present' | 'absent' | 'makeup'>, lesson: Lesson) => {
                              lesson.class.enrollments.forEach((enrollment: Enrollment) => {
                                const studentStatus = attendanceRecords[lesson.id]?.[enrollment.student.id];
                                if (studentStatus) {
                                  acc[enrollment.student.id] = studentStatus;
                                }
                              });
                              return acc;
                            }, {})
                          }
                        />
                      </div>
                    ) : (
                      <div className="w-full aspect-video bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                        <div className="text-center text-gray-500">
                          <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Câmera desativada</p>
                          <p className="text-xs">Clique em "Iniciar Reconhecimento" para ativar</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lessons Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {lessons.map((lesson: Lesson) => {
                const records = attendanceRecords[lesson.id] || {};
                const present = Object.values(records).filter(status => status === 'present').length;
                const absent = Object.values(records).filter(status => status === 'absent').length;
                const makeup = Object.values(records).filter(status => status === 'makeup').length;
                
                return (
                  <Card key={lesson.id} className="h-fit">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="flex items-center text-lg">
                            <Clock className="w-4 h-4 mr-2" />
                            {format(new Date(lesson.scheduledDate), 'HH:mm', { locale: ptBR })} - {lesson.title}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {lesson.class.course.name} • {lesson.class.name}
                          </CardDescription>
                        </div>
                        <div className="flex flex-col items-end space-y-1">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="text-green-600">
                              <UserCheck className="w-3 h-3 mr-1" />
                              {present}
                            </Badge>
                            <Badge variant="outline" className="text-red-600">
                              <UserX className="w-3 h-3 mr-1" />
                              {absent}
                            </Badge>
                            {makeup > 0 && (
                              <Badge variant="outline" className="text-blue-600">
                                <RotateCcw className="w-3 h-3 mr-1" />
                                {makeup}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {lesson.class.enrollments.map((enrollment) => {
                          const student = enrollment.student;
                          const currentStatus = attendanceRecords[lesson.id]?.[student.id] || 'absent';
                          const isRecognized = recognizedStudents.has(student.id);

                          return (
                            <div key={student.id} className="flex items-center justify-between p-2 rounded-lg border bg-white">
                              <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-2">
                                  <User className="w-4 h-4 text-gray-400" />
                                  <span className="font-medium">{student.name}</span>
                                  {isRecognized && (
                                    <Badge variant="outline" className="text-green-600 text-xs">
                                      <Check className="w-3 h-3 mr-1" />
                                      Reconhecido
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex space-x-1">
                                <Button
                                  size="sm"
                                  variant={currentStatus === 'present' ? 'default' : 'outline'}
                                  onClick={() => updateAttendance(lesson.id, student.id, 'present')}
                                  className={currentStatus === 'present' ? 'bg-green-600 hover:bg-green-700' : ''}
                                >
                                  <UserCheck className="w-4 h-4 mr-1" />
                                  Presente
                                </Button>
                                <Button
                                  size="sm"
                                  variant={currentStatus === 'absent' ? 'default' : 'outline'}
                                  onClick={() => updateAttendance(lesson.id, student.id, 'absent')}
                                  className={currentStatus === 'absent' ? 'bg-red-600 hover:bg-red-700' : ''}
                                >
                                  <UserX className="w-4 h-4 mr-1" />
                                  Ausente
                                </Button>
                                <Button
                                  size="sm"
                                  variant={currentStatus === 'makeup' ? 'default' : 'outline'}
                                  onClick={() => updateAttendance(lesson.id, student.id, 'makeup')}
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
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
