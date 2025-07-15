'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Calendar, ArrowLeft, Plus, Search, Edit, Trash2, Users, BookOpen, ChevronDown, ChevronRight, Mail, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { canManageClasses } from '@/lib/roles';

interface Class {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  maxStudents?: number;
  course: {
    id: string;
    name: string;
  };
  _count: {
    enrollments: number;
    lessons: number;
  };
}

interface Student {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
}

export default function ClassesManagement() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { showConfirmation, ConfirmationDialog } = useConfirmationDialog();
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [classStudents, setClassStudents] = useState<Record<string, Student[]>>({});
  const [loadingStudents, setLoadingStudents] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
      return;
    }

    if (user) {
      fetchClasses();
    }
  }, [user, loading]);

  const fetchClasses = async () => {
    try {
      setIsLoading(true);
      const url = searchTerm
        ? `/api/classes?search=${encodeURIComponent(searchTerm)}`
        : '/api/classes';

      // Get token from localStorage
      const token = localStorage.getItem('auth_token');

      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch classes');
      }

      const result = await response.json();
      setClasses(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    fetchClasses();
  };

  const handleDelete = (classId: string, className: string) => {
    showConfirmation({
      title: 'Excluir Turma',
      description: `Tem certeza que deseja excluir a turma "${className}"? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
      icon: 'delete',
      onConfirm: async () => {
        try {
          const token = localStorage.getItem('auth_token');

          if (!token) {
            toast.error('Sessão expirada. Faça login novamente.');
            router.push('/login');
            return;
          }

          const response = await fetch(`/api/classes/${classId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete class');
          }

          toast.success('Turma excluída com sucesso!');
          fetchClasses();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Erro ao excluir turma');
        }
      }
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const fetchClassStudents = async (classId: string) => {
    if (classStudents[classId]) {
      return; // Already loaded
    }

    try {
      setLoadingStudents(prev => new Set(prev).add(classId));

      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/enrollments?classId=${classId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch students');
      }

      const result = await response.json();
      const students = result.data.map((enrollment: any) => enrollment.student);

      setClassStudents(prev => ({
        ...prev,
        [classId]: students
      }));
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error('Erro ao carregar alunos da turma');
    } finally {
      setLoadingStudents(prev => {
        const newSet = new Set(prev);
        newSet.delete(classId);
        return newSet;
      });
    }
  };

  const toggleClassExpansion = (classId: string) => {
    const newExpanded = new Set(expandedClasses);
    if (newExpanded.has(classId)) {
      newExpanded.delete(classId);
    } else {
      newExpanded.add(classId);
      fetchClassStudents(classId);
    }
    setExpandedClasses(newExpanded);
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto animate-spin" size={48} />
          <p className="mt-4 text-muted-foreground">Carregando turmas...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Erro</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button onClick={fetchClasses} className="mt-4">
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
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
              <Calendar className="w-8 h-8 mr-3" />
              Gerenciar Turmas
            </h1>
          </div>
          <Button onClick={() => router.push('/admin/classes/new')}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Turma
          </Button>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Buscar turmas por nome ou curso..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button onClick={handleSearch}>
                <Search className="w-4 h-4 mr-2" />
                Buscar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Classes Table */}
        <Card>
          <CardHeader>
            <CardTitle>Turmas Cadastradas</CardTitle>
            <CardDescription>
              {classes.length} turma{classes.length !== 1 ? 's' : ''} encontrada{classes.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {classes.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold text-foreground">
                  Nenhuma turma encontrada
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchTerm ? 'Tente uma busca diferente.' : 'Comece cadastrando uma nova turma.'}
                </p>
                {!searchTerm && (
                  <Button onClick={() => router.push('/admin/classes/new')} className="mt-4">
                    <Plus className="w-4 h-4 mr-2" />
                    Cadastrar Primeira Turma
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Curso</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Alunos</TableHead>
                    <TableHead>Aulas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.map((classItem) => (
                    <React.Fragment key={classItem.id}>
                      <TableRow>
                        <TableCell>
                          <div className="flex items-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleClassExpansion(classItem.id)}
                              className="mr-2 p-1"
                            >
                              {expandedClasses.has(classItem.id) ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </Button>
                            <div>
                              <div className="font-medium">{classItem.name}</div>
                              {classItem.description && (
                                <div className="text-sm text-muted-foreground">
                                  {classItem.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <BookOpen className="w-4 h-4 mr-2" />
                            {classItem.course.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>Início: {formatDate(classItem.startDate)}</div>
                            {classItem.endDate && (
                              <div className="text-muted-foreground">
                                Fim: {formatDate(classItem.endDate)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Users className="w-4 h-4 mr-2" />
                            {classItem._count.enrollments}
                            {classItem.maxStudents && `/${classItem.maxStudents}`}
                          </div>
                        </TableCell>
                        <TableCell>{classItem._count.lessons}</TableCell>
                        <TableCell>
                          <Badge variant={classItem.isActive ? 'success' : 'secondary'}>
                            {classItem.isActive ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              onClick={() => router.push(`/admin/classes/${classItem.id}/edit`)}
                              variant="outline"
                              size="sm"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => handleDelete(classItem.id, classItem.name)}
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedClasses.has(classItem.id) && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-muted/50">
                            <div className="py-4">
                              <h4 className="font-medium mb-3 flex items-center">
                                <Users className="w-4 h-4 mr-2" />
                                Alunos Matriculados ({classItem._count.enrollments})
                              </h4>
                              {loadingStudents.has(classItem.id) ? (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                  Carregando alunos...
                                </div>
                              ) : classStudents[classItem.id]?.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {classStudents[classItem.id].map((student) => (
                                    <div
                                      key={student.id}
                                      className="bg-background rounded-lg p-3 border"
                                    >
                                      <div className="font-medium text-sm">{student.name}</div>
                                      {student.email && (
                                        <div className="flex items-center text-xs text-muted-foreground mt-1">
                                          <Mail className="w-3 h-3 mr-1" />
                                          {student.email}
                                        </div>
                                      )}
                                      {student.phone && (
                                        <div className="flex items-center text-xs text-muted-foreground mt-1">
                                          <Phone className="w-3 h-3 mr-1" />
                                          {student.phone}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-4 text-muted-foreground">
                                  Nenhum aluno matriculado nesta turma
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      <ConfirmationDialog />
    </div>
  );
}
