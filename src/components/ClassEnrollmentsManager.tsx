'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  UserPlus, 
  MoreHorizontal, 
  Search, 
  Users, 
  AlertCircle,
  CheckCircle,
  ArrowRightLeft,
  RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { EnrollStudentDialog } from './EnrollStudentDialog';
import { TransferStudentDialog } from './TransferStudentDialog';
import { apiClient } from '@/lib/api-client';

interface Enrollment {
  id: string;
  status: 'active' | 'inactive' | 'completed' | 'transferred';
  type: 'regular' | 'guest' | 'restart';
  absenceCount: number;
  enrolledAt: string;
  inactivatedAt: string | null;
  reactivatedAt: string | null;
  notes: string | null;
  student: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    status: string;
  };
  transferredFrom?: {
    id: string;
    class: {
      id: string;
      name: string;
    };
  };
}

interface ClassEnrollmentsManagerProps {
  classId: string;
  courseId: string;
  className: string;
  courseName: string;
  maxStudents?: number;
}

export function ClassEnrollmentsManager({
  classId,
  courseId,
  className,
  courseName,
  maxStudents
}: ClassEnrollmentsManagerProps) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);

  useEffect(() => {
    loadEnrollments();
  }, [classId]);

  const loadEnrollments = async () => {
    try {
      setLoading(true);
      const result = await apiClient.getEnrollments({ classId });
      setEnrollments(result.data);
    } catch (error) {
      console.error('Error loading enrollments:', error);
      toast.error('Erro ao carregar matrículas');
    } finally {
      setLoading(false);
    }
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

  const handleDeleteEnrollment = async (enrollmentId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta matrícula?')) {
      return;
    }

    try {
      const response = await fetch(`/api/enrollments/${enrollmentId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao excluir matrícula');
      }

      toast.success('Matrícula excluída com sucesso!');
      loadEnrollments();
    } catch (error) {
      console.error('Error deleting enrollment:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir matrícula');
    }
  };

  const handleTransferEnrollment = (enrollment: Enrollment) => {
    setSelectedEnrollment(enrollment);
    setShowTransferDialog(true);
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

  const filteredEnrollments = enrollments.filter(enrollment =>
    enrollment.student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    enrollment.student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    enrollment.student.phone?.includes(searchTerm)
  );

  const activeEnrollments = enrollments.filter(e => e.status === 'active').length;
  const inactiveEnrollments = enrollments.filter(e => e.status === 'inactive').length;
  const isClassFull = maxStudents && activeEnrollments >= maxStudents;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Alunos Matriculados - {className}
              </CardTitle>
              <CardDescription>
                {courseName} • {activeEnrollments} ativo{activeEnrollments !== 1 ? 's' : ''} • {inactiveEnrollments} inativo{inactiveEnrollments !== 1 ? 's' : ''}
                {maxStudents && (
                  <span className={`ml-2 ${isClassFull ? 'text-destructive' : ''}`}>
                    • Capacidade: {activeEnrollments}/{maxStudents}
                  </span>
                )}
              </CardDescription>
            </div>
            <Button 
              onClick={() => setShowEnrollDialog(true)}
              disabled={isClassFull}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Matricular Aluno
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Carregando matrículas...</p>
              </div>
            ) : filteredEnrollments.length === 0 ? (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold text-foreground">
                  {searchTerm ? 'Nenhum aluno encontrado' : 'Nenhum aluno matriculado'}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchTerm 
                    ? 'Tente uma busca diferente.' 
                    : 'Comece matriculando o primeiro aluno nesta turma.'
                  }
                </p>
                {!searchTerm && (
                  <Button 
                    onClick={() => setShowEnrollDialog(true)} 
                    className="mt-4"
                    disabled={isClassFull}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Matricular Primeiro Aluno
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Faltas</TableHead>
                    <TableHead>Matriculado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEnrollments.map((enrollment) => (
                    <TableRow key={enrollment.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{enrollment.student.name}</div>
                          {enrollment.transferredFrom && (
                            <div className="text-xs text-muted-foreground">
                              Transferido de: {enrollment.transferredFrom.class.name}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {enrollment.student.email && (
                            <div className="text-sm">{enrollment.student.email}</div>
                          )}
                          {enrollment.student.phone && (
                            <div className="text-sm text-muted-foreground">{enrollment.student.phone}</div>
                          )}
                        </div>
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
                          {new Date(enrollment.enrolledAt).toLocaleDateString('pt-BR')}
                        </div>
                        {enrollment.inactivatedAt && (
                          <div className="text-xs text-muted-foreground">
                            Inativado: {new Date(enrollment.inactivatedAt).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            
                            {enrollment.status === 'active' && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleTransferEnrollment(enrollment)}
                                >
                                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                                  Transferir para outra turma
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}

                            {enrollment.status === 'inactive' && (
                              <>
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
                                <DropdownMenuSeparator />
                              </>
                            )}

                            <DropdownMenuItem
                              onClick={() => handleDeleteEnrollment(enrollment.id)}
                              className="text-destructive"
                            >
                              Excluir Matrícula
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <EnrollStudentDialog
        open={showEnrollDialog}
        onOpenChange={setShowEnrollDialog}
        onEnrollmentCreated={loadEnrollments}
        preselectedClassId={classId}
        preselectedCourseId={courseId}
      />

      <TransferStudentDialog
        open={showTransferDialog}
        onOpenChange={setShowTransferDialog}
        enrollment={selectedEnrollment}
        onTransferCompleted={loadEnrollments}
      />
    </div>
  );
}
