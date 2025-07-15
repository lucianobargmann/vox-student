'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Edit,
  Calendar,
  Users,
  BookOpen,
  Clock,
  Loader2,
  CheckSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { ClassEnrollmentsManager } from '@/components/ClassEnrollmentsManager';
import { AvailableStudentsTab } from '@/components/AvailableStudentsTab';
import { apiClient } from '@/lib/api-client';

interface ClassData {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  schedule: string | null;
  maxStudents: number | null;
  isActive: boolean;
  course: {
    id: string;
    name: string;
    allowsMakeup: boolean;
  };
  lessons: Array<{
    id: string;
    title: string;
    scheduledDate: string;
    duration: number | null;
    isCompleted: boolean;
    _count: {
      attendance: number;
    };
  }>;
  enrollments: Array<{
    id: string;
    status: string;
    student: {
      id: string;
      name: string;
    };
  }>;
  _count: {
    enrollments: number;
    lessons: number;
  };
}

export default function ClassDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);

  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  useEffect(() => {
    if (!authLoading && (!user || user.profile?.role !== 'admin')) {
      router.push('/');
      return;
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (resolvedParams?.id) {
      loadClassData();
    }
  }, [resolvedParams]);

  const loadClassData = async () => {
    if (!resolvedParams?.id) return;

    try {
      setLoading(true);
      const result = await apiClient.getClass(resolvedParams.id);
      setClassData(result.data);
    } catch (error) {
      console.error('Error loading class:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar turma');
      router.push('/admin/classes');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto animate-spin" size={48} />
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user || user.profile?.role !== 'admin' || !classData) {
    return null;
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const parseSchedule = (scheduleString: string | null) => {
    if (!scheduleString) return null;
    try {
      return JSON.parse(scheduleString);
    } catch {
      return null;
    }
  };

  const schedule = parseSchedule(classData.schedule);
  const activeEnrollments = classData.enrollments.filter(e => e.status === 'active').length;
  const completedLessons = classData.lessons.filter(l => l.isCompleted).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <Button onClick={() => router.push('/admin/classes')} variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <BookOpen className="w-8 h-8 mr-3" />
                {classData.name}
              </h1>
              <p className="text-muted-foreground">{classData.course.name}</p>
            </div>
          </div>
          <Button onClick={() => router.push(`/admin/classes/${classData.id}/edit`)}>
            <Edit className="w-4 h-4 mr-2" />
            Editar Turma
          </Button>
        </div>

        {/* Class Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alunos Ativos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {activeEnrollments}
                {classData.maxStudents && (
                  <span className="text-sm font-normal text-muted-foreground">
                    /{classData.maxStudents}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aulas</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {completedLessons}/{classData._count.lessons}
              </div>
              <p className="text-xs text-muted-foreground">
                {completedLessons > 0 
                  ? `${Math.round((completedLessons / classData._count.lessons) * 100)}% concluído`
                  : 'Não iniciado'
                }
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Badge variant={classData.isActive ? 'default' : 'secondary'}>
                {classData.isActive ? 'Ativa' : 'Inativa'}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Período</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                <div>{formatDate(classData.startDate)}</div>
                {classData.endDate && (
                  <div className="text-muted-foreground">
                    até {formatDate(classData.endDate)}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Class Details */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Informações da Turma</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">Descrição</h4>
                <p className="text-muted-foreground">
                  {classData.description || 'Nenhuma descrição fornecida'}
                </p>
              </div>
              
              {schedule && (
                <div>
                  <h4 className="font-medium mb-2">Horário</h4>
                  <div className="space-y-1">
                    {schedule.days && schedule.days.map((day: string) => (
                      <div key={day} className="text-sm">
                        <span className="capitalize">{day}</span>
                        {schedule.time && <span className="text-muted-foreground"> - {schedule.time}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabs for different sections */}
        <Tabs defaultValue="enrollments" className="space-y-6">
          <TabsList>
            <TabsTrigger value="enrollments">Matrículas</TabsTrigger>
            <TabsTrigger value="available-students">Alunos Disponíveis</TabsTrigger>
            <TabsTrigger value="lessons">Aulas</TabsTrigger>
          </TabsList>

          <TabsContent value="enrollments">
            <ClassEnrollmentsManager
              classId={classData.id}
              courseId={classData.course.id}
              className={classData.name}
              courseName={classData.course.name}
              maxStudents={classData.maxStudents || undefined}
            />
          </TabsContent>

          <TabsContent value="available-students">
            <AvailableStudentsTab
              classId={classData.id}
              courseId={classData.course.id}
              courseName={classData.course.name}
              onEnrollmentCreated={loadClassData}
            />
          </TabsContent>

          <TabsContent value="lessons">
            <Card>
              <CardHeader>
                <CardTitle>Aulas da Turma</CardTitle>
                <CardDescription>
                  {classData._count.lessons} aula{classData._count.lessons !== 1 ? 's' : ''} programada{classData._count.lessons !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {classData.lessons.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-semibold text-foreground">
                      Nenhuma aula programada
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      As aulas desta turma ainda não foram criadas.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {classData.lessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{lesson.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatDateTime(lesson.scheduledDate)}
                            {lesson.duration && (
                              <span> • {lesson.duration} minutos</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Badge variant={lesson.isCompleted ? 'default' : 'outline'}>
                              {lesson.isCompleted ? 'Concluída' : 'Pendente'}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {lesson._count.attendance} presença{lesson._count.attendance !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/admin/attendance/${lesson.id}`)}
                          >
                            <CheckSquare className="w-4 h-4 mr-1" />
                            Presença
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
