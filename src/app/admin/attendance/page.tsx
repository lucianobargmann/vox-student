'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckSquare, ArrowLeft, Calendar, Clock, Users, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Student {
  id: string;
  name: string;
  email?: string;
  phone?: string;
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

interface Lesson {
  id: string;
  title: string;
  description?: string;
  scheduledDate: string;
  duration?: number;
  location?: string;
  isCompleted: boolean;
  class: Class;
  attendance: Array<{
    id: string;
    status: 'present' | 'absent' | 'makeup';
    student: Student;
  }>;
}

export default function AttendanceManagement() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      setLessons(result.data || []);
    } catch (error) {
      console.error('Error loading today\'s lessons:', error);
      toast.error('Erro ao carregar aulas de hoje');
    } finally {
      setIsLoading(false);
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
  }, [user, loading, router]);

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

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), "HH:mm", { locale: ptBR });
  };

  const getAttendanceStats = (lesson: Lesson) => {
    const present = lesson.attendance.filter(a => a.status === 'present').length;
    const total = lesson.class.enrollments.length;
    return { present, total };
  };

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
              Controle de Presença
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
          <div className="space-y-6">
            {lessons.map((lesson) => {
              const stats = getAttendanceStats(lesson);
              const hasAttendance = lesson.attendance.length > 0;

              return (
                <Card key={lesson.id} data-testid="lesson-card" className="overflow-hidden">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center">
                          <Clock className="w-5 h-5 mr-2" />
                          {formatTime(lesson.scheduledDate)} - {lesson.title}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {lesson.class.course.name} • {lesson.class.name}
                        </CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        {lesson.isCompleted ? (
                          <Badge variant="success">Concluída</Badge>
                        ) : (
                          <Badge variant="secondary">Agendada</Badge>
                        )}
                        {hasAttendance && (
                          <Badge variant="outline">
                            {stats.present}/{stats.total} presentes
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      {/* Class Info */}
                      <div className="space-y-3">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Users className="w-4 h-4 mr-2" />
                          {lesson.class.enrollments.length} alunos matriculados
                        </div>
                        {lesson.location && (
                          <div className="flex items-center text-sm text-muted-foreground">
                            <MapPin className="w-4 h-4 mr-2" />
                            {lesson.location}
                          </div>
                        )}
                        {lesson.description && (
                          <p className="text-sm text-muted-foreground">
                            {lesson.description}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col space-y-2">
                        <Button
                          onClick={() => router.push(`/admin/attendance/${lesson.id}`)}
                          className="w-full"
                        >
                          <CheckSquare className="w-4 h-4 mr-2" />
                          {hasAttendance ? 'Editar Presença' : 'Marcar Presença'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => router.push(`/admin/classes/${lesson.class.id}/edit`)}
                          className="w-full"
                        >
                          Ver Turma
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
