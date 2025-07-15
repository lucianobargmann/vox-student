'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, BarChart3, ArrowLeft, Users, BookOpen, Calendar, TrendingUp, Download, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Stats {
  totalStudents: number;
  totalCourses: number;
  totalClasses: number;
  activeEnrollments: number;
}

export default function ReportsManagement() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && (!user || user.profile?.role !== 'admin')) {
      router.push('/');
      return;
    }

    if (user && user.profile?.role === 'admin') {
      fetchStats();
    }
  }, [user, loading, router]);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      // Fetch basic statistics
      const [studentsRes, coursesRes, classesRes] = await Promise.all([
        fetch('/api/students'),
        fetch('/api/courses'),
        fetch('/api/classes')
      ]);

      if (studentsRes.ok && coursesRes.ok && classesRes.ok) {
        const [students, courses, classes] = await Promise.all([
          studentsRes.json(),
          coursesRes.json(),
          classesRes.json()
        ]);

        setStats({
          totalStudents: students.data?.length || 0,
          totalCourses: courses.data?.length || 0,
          totalClasses: classes.data?.length || 0,
          activeEnrollments: students.data?.reduce((acc: number, student: any) =>
            acc + (student._count?.enrollments || 0), 0) || 0
        });
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto animate-spin" size={48} />
          <p className="mt-4 text-muted-foreground">Carregando relatórios...</p>
        </div>
      </div>
    );
  }

  if (!user || user.profile?.role !== 'admin') {
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
              <BarChart3 className="w-8 h-8 mr-3" />
              Relatórios
            </h1>
          </div>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Alunos</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalStudents}</div>
                <p className="text-xs text-muted-foreground">
                  Alunos cadastrados no sistema
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Cursos</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalCourses}</div>
                <p className="text-xs text-muted-foreground">
                  Cursos disponíveis
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Turmas</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalClasses}</div>
                <p className="text-xs text-muted-foreground">
                  Turmas ativas e inativas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Matrículas Ativas</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeEnrollments}</div>
                <p className="text-xs text-muted-foreground">
                  Alunos matriculados
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Report Actions */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Relatório de Alunos
              </CardTitle>
              <CardDescription>
                Lista completa de alunos com informações de contato e status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" disabled>
                <Download className="w-4 h-4 mr-2" />
                Gerar Relatório
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BookOpen className="w-5 h-5 mr-2" />
                Relatório de Cursos
              </CardTitle>
              <CardDescription>
                Informações detalhadas sobre cursos e suas turmas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" disabled>
                <Download className="w-4 h-4 mr-2" />
                Gerar Relatório
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                Relatório de Presença
              </CardTitle>
              <CardDescription>
                Frequência e presença dos alunos por período
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" disabled>
                <Download className="w-4 h-4 mr-2" />
                Gerar Relatório
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Relatório Financeiro
              </CardTitle>
              <CardDescription>
                Análise de receitas e matrículas por período
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" disabled>
                <Download className="w-4 h-4 mr-2" />
                Gerar Relatório
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Relatório Personalizado
              </CardTitle>
              <CardDescription>
                Crie relatórios customizados com filtros específicos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" disabled>
                <Download className="w-4 h-4 mr-2" />
                Criar Relatório
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Dashboard Executivo
              </CardTitle>
              <CardDescription>
                Visão geral com gráficos e métricas principais
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" disabled>
                <TrendingUp className="w-4 h-4 mr-2" />
                Ver Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="text-center text-sm text-muted-foreground">
              <p>💡 <strong>Em breve:</strong> Relatórios em PDF, agendamento automático, filtros avançados e muito mais!</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
