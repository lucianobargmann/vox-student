'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  MoreHorizontal, 
  GraduationCap, 
  AlertCircle,
  CheckCircle,
  ArrowRightLeft,
  RotateCcw,
  Calendar,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { enrollmentsService } from '@/lib/services/enrollments.service';

interface Enrollment {
  id: string;
  status: 'active' | 'inactive' | 'completed' | 'transferred';
  type: 'regular' | 'guest' | 'restart';
  absenceCount: number;
  enrolledAt: string;
  inactivatedAt: string | null;
  reactivatedAt: string | null;
  notes: string | null;
  course: {
    id: string;
    name: string;
    allowsMakeup: boolean;
  };
  class: {
    id: string;
    name: string;
    startDate: string;
    endDate: string | null;
  } | null;
  transferredFrom?: {
    id: string;
    class: {
      id: string;
      name: string;
    };
  };
}

interface StudentEnrollmentsViewProps {
  studentId: string;
  studentName: string;
}

export function StudentEnrollmentsView({ studentId, studentName }: StudentEnrollmentsViewProps) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    completed: 0,
    transferred: 0,
    totalAbsences: 0,
    averageAbsences: 0
  });

  useEffect(() => {
    loadEnrollments();
  }, [studentId]);

  const loadEnrollments = async () => {
    try {
      setLoading(true);
      const result = await enrollmentsService.getEnrollments(undefined, studentId);

      if (result.success && result.data) {
        setEnrollments(result.data);
        calculateStats(result.data);
      } else {
        throw new Error(result.error || 'Erro ao carregar matrículas');
      }
    } catch (error) {
      console.error('Error loading enrollments:', error);
      toast.error('Erro ao carregar matrículas');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (enrollments: Enrollment[]) => {
    const stats = {
      total: enrollments.length,
      active: enrollments.filter(e => e.status === 'active').length,
      inactive: enrollments.filter(e => e.status === 'inactive').length,
      completed: enrollments.filter(e => e.status === 'completed').length,
      transferred: enrollments.filter(e => e.status === 'transferred').length,
      totalAbsences: enrollments.reduce((sum, e) => sum + e.absenceCount, 0),
      averageAbsences: enrollments.length > 0 
        ? enrollments.reduce((sum, e) => sum + e.absenceCount, 0) / enrollments.length 
        : 0
    };
    setStats(stats);
  };

  const handleReactivateEnrollment = async (enrollmentId: string, resetAbsences: boolean = false) => {
    try {
      const response = await fetch(`/api/enrollments/${enrollmentId}/reactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resetAbsences }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao reativar matrícula');
      }

      toast.success(result.message || 'Matrícula reativada com sucesso!');
      loadEnrollments();
    } catch (error) {
      console.error('Error reactivating enrollment:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao reativar matrícula');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Ativo
        </Badge>;
      case 'inactive':
        return <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Inativo
        </Badge>;
      case 'completed':
        return <Badge variant="secondary" className="flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Concluído
        </Badge>;
      case 'transferred':
        return <Badge variant="outline" className="flex items-center gap-1">
          <ArrowRightLeft className="w-3 h-3" />
          Transferido
        </Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'regular':
        return <Badge variant="default">Regular</Badge>;
      case 'guest':
        return <Badge variant="secondary">Convidado</Badge>;
      case 'restart':
        return <Badge variant="outline">Reinício</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2">Carregando matrículas...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ativas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inativas</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.inactive}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faltas Totais</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAbsences}</div>
            <p className="text-xs text-muted-foreground">
              Média: {stats.averageAbsences.toFixed(1)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Enrollments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Matrículas de {studentName}
          </CardTitle>
          <CardDescription>
            Histórico completo de matrículas do aluno
          </CardDescription>
        </CardHeader>
        <CardContent>
          {enrollments.length === 0 ? (
            <div className="text-center py-8">
              <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold text-foreground">
                Nenhuma matrícula encontrada
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Este aluno ainda não foi matriculado em nenhum curso.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Curso</TableHead>
                  <TableHead>Turma</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Faltas</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.map((enrollment) => (
                  <TableRow key={enrollment.id}>
                    <TableCell>
                      <div className="font-medium">{enrollment.course.name}</div>
                      {enrollment.course.allowsMakeup && (
                        <div className="text-xs text-muted-foreground">
                          Permite reposição
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        {enrollment.class ? (
                          <>
                            <div className="font-medium">{enrollment.class.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(enrollment.class.startDate)}
                              {enrollment.class.endDate && (
                                <span> - {formatDate(enrollment.class.endDate)}</span>
                              )}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Sem turma específica</span>
                        )}
                      </div>
                      {enrollment.transferredFrom && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Transferido de: {enrollment.transferredFrom.class.name}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(enrollment.status)}</TableCell>
                    <TableCell>{getTypeBadge(enrollment.type)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className={enrollment.absenceCount >= 3 ? 'text-destructive font-medium' : ''}>
                          {enrollment.absenceCount}
                        </span>
                        {enrollment.absenceCount >= 3 && (
                          <AlertCircle className="w-4 h-4 text-destructive" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(enrollment.enrolledAt)}
                        </div>
                        {enrollment.inactivatedAt && (
                          <div className="text-xs text-muted-foreground">
                            Inativado: {formatDate(enrollment.inactivatedAt)}
                          </div>
                        )}
                        {enrollment.reactivatedAt && (
                          <div className="text-xs text-green-600">
                            Reativado: {formatDate(enrollment.reactivatedAt)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {enrollment.status === 'inactive' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleReactivateEnrollment(enrollment.id, false)}
                            >
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Reativar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleReactivateEnrollment(enrollment.id, true)}
                            >
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Reativar (zerar faltas)
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
