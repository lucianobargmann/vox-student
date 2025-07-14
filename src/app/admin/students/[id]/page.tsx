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
  User, 
  Mail,
  Phone,
  Calendar,
  GraduationCap,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { StudentEnrollmentsView } from '@/components/StudentEnrollmentsView';

interface StudentData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  registrationDate: string;
  status: string;
  notes: string | null;
  enrollments: Array<{
    id: string;
    status: string;
    type: string;
    course: {
      id: string;
      name: string;
    };
    class: {
      id: string;
      name: string;
    } | null;
  }>;
  attendance: Array<{
    id: string;
    status: string;
    markedAt: string | null;
    lesson: {
      id: string;
      title: string;
      scheduledDate: string;
      class: {
        id: string;
        name: string;
        course: {
          id: string;
          name: string;
        };
      };
    };
  }>;
  _count: {
    attendance: number;
    enrollments: number;
  };
}

export default function StudentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [studentData, setStudentData] = useState<StudentData | null>(null);
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
      loadStudentData();
    }
  }, [resolvedParams]);

  const loadStudentData = async () => {
    if (!resolvedParams?.id) return;

    try {
      setLoading(true);

      // Get token from localStorage
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/students/${resolvedParams.id}`, { headers });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao carregar aluno');
      }

      setStudentData(result.data);
    } catch (error) {
      console.error('Error loading student:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar aluno');
      router.push('/admin/students');
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

  if (!user || user.profile?.role !== 'admin' || !studentData) {
    return null;
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const activeEnrollments = studentData.enrollments.filter(e => e.status === 'active').length;
  const presentAttendances = studentData.attendance.filter(a => a.status === 'present').length;
  const absentAttendances = studentData.attendance.filter(a => a.status === 'absent').length;
  const attendanceRate = studentData._count.attendance > 0 
    ? Math.round((presentAttendances / studentData._count.attendance) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <Button onClick={() => router.push('/admin/students')} variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <User className="w-8 h-8 mr-3" />
                {studentData.name}
              </h1>
              <p className="text-muted-foreground">
                Cadastrado em {formatDate(studentData.registrationDate)}
              </p>
            </div>
          </div>
          <Button onClick={() => router.push(`/admin/students/${studentData.id}/edit`)}>
            <Edit className="w-4 h-4 mr-2" />
            Editar Aluno
          </Button>
        </div>

        {/* Student Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Badge variant={studentData.status === 'active' ? 'default' : 'secondary'}>
                {studentData.status === 'active' ? 'Ativo' : 'Inativo'}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Matrículas Ativas</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeEnrollments}</div>
              <p className="text-xs text-muted-foreground">
                {studentData._count.enrollments} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Presenças</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{presentAttendances}</div>
              <p className="text-xs text-muted-foreground">
                {studentData._count.attendance} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Presença</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{attendanceRate}%</div>
              <p className="text-xs text-muted-foreground">
                {absentAttendances} faltas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Student Details */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Informações Pessoais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {studentData.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{studentData.email}</span>
                  </div>
                )}
                
                {studentData.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{studentData.phone}</span>
                  </div>
                )}
                
                {studentData.birthDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>Nascimento: {formatDate(studentData.birthDate)}</span>
                  </div>
                )}
              </div>
              
              {studentData.notes && (
                <div>
                  <h4 className="font-medium mb-2">Observações</h4>
                  <p className="text-muted-foreground">{studentData.notes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabs for different sections */}
        <Tabs defaultValue="enrollments" className="space-y-6">
          <TabsList>
            <TabsTrigger value="enrollments">Matrículas</TabsTrigger>
            <TabsTrigger value="attendance">Histórico de Presença</TabsTrigger>
          </TabsList>

          <TabsContent value="enrollments">
            <StudentEnrollmentsView
              studentId={studentData.id}
              studentName={studentData.name}
            />
          </TabsContent>

          <TabsContent value="attendance">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Presença</CardTitle>
                <CardDescription>
                  {studentData._count.attendance} registro{studentData._count.attendance !== 1 ? 's' : ''} de presença
                </CardDescription>
              </CardHeader>
              <CardContent>
                {studentData.attendance.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-semibold text-foreground">
                      Nenhum registro de presença
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Este aluno ainda não tem registros de presença.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {studentData.attendance
                      .sort((a, b) => new Date(b.lesson.scheduledDate).getTime() - new Date(a.lesson.scheduledDate).getTime())
                      .map((attendance) => (
                        <div
                          key={attendance.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div>
                            <div className="font-medium">{attendance.lesson.title}</div>
                            <div className="text-sm text-muted-foreground">
                              {attendance.lesson.class.course.name} • {attendance.lesson.class.name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatDateTime(attendance.lesson.scheduledDate)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={
                                attendance.status === 'present' ? 'default' :
                                attendance.status === 'absent' ? 'destructive' : 'secondary'
                              }
                            >
                              {attendance.status === 'present' ? 'Presente' :
                               attendance.status === 'absent' ? 'Ausente' : 'Reposição'}
                            </Badge>
                            {attendance.markedAt && (
                              <span className="text-xs text-muted-foreground">
                                Marcado: {formatDateTime(attendance.markedAt)}
                              </span>
                            )}
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
