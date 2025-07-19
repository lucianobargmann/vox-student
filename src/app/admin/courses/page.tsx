'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, BookOpen, ArrowLeft, Plus, Search, Edit, Trash2, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';

interface Course {
  id: string;
  name: string;
  description?: string;
  duration?: number;
  price?: number;
  allowsMakeup: boolean;
  isActive: boolean;
  createdAt: string;
  _count?: {
    classes: number;
    enrollments: number;
  };
}

export default function CoursesManagement() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { showConfirmation, ConfirmationDialog } = useConfirmationDialog();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || !['admin', 'super_admin'].includes(user.profile?.role || ''))) {
      router.push('/');
      return;
    }

    if (user && ['admin', 'super_admin'].includes(user.profile?.role || '')) {
      fetchCourses();
    }
  }, [user, loading]);

  const fetchCourses = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const url = searchTerm
        ? `/api/courses?search=${encodeURIComponent(searchTerm)}`
        : '/api/courses';

      const token = localStorage.getItem('auth_token');
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Falha ao carregar cursos');
      }

      const result = await response.json();
      setCourses(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    fetchCourses();
  };

  const handleDelete = (courseId: string, courseName: string) => {
    showConfirmation({
      title: 'Excluir Curso',
      description: `Tem certeza que deseja excluir o curso "${courseName}"? Esta ação não pode ser desfeita.`,
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

          const response = await fetch(`/api/courses/${courseId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Falha ao excluir curso');
          }

          toast.success('Curso excluído com sucesso!');
          fetchCourses();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Erro ao excluir curso');
        }
      }
    });
  };

  const formatCurrency = (value?: number) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto animate-spin" size={48} />
          <p className="mt-4 text-muted-foreground">Carregando cursos...</p>
        </div>
      </div>
    );
  }

  if (!user || !['admin', 'super_admin'].includes(user.profile?.role || '')) {
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
            <Button onClick={fetchCourses} className="mt-4">
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
        {/* Header Section */}
        <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-2xl p-8 text-white shadow-xl mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button onClick={() => router.push('/')} variant="outline" size="sm" className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <div>
                <h1 className="text-3xl font-bold mb-2 flex items-center">
                  <BookOpen className="w-8 h-8 mr-3" />
                  Gerenciar Cursos
                </h1>
                <p className="text-white/90">
                  Administre cursos, preços e configurações
                </p>
              </div>
            </div>
            <div className="hidden md:block">
              <Button 
                onClick={() => router.push('/admin/courses/new')}
                className="bg-white/20 text-white border-white/30 hover:bg-white/30 backdrop-blur-sm"
                size="lg"
              >
                <Plus className="w-5 h-5 mr-2" />
                Novo Curso
              </Button>
            </div>
          </div>
          {/* Mobile button */}
          <div className="md:hidden mt-4">
            <Button 
              onClick={() => router.push('/admin/courses/new')}
              className="bg-white/20 text-white border-white/30 hover:bg-white/30 backdrop-blur-sm w-full"
            >
              <Plus className="w-5 h-5 mr-2" />
              Novo Curso
            </Button>
          </div>
        </div>

        {/* Search Section */}
        <Card className="mb-6 shadow-lg border-0">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Buscar cursos por nome ou descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="border-2 border-gray-200 focus:border-[#667eea] focus:ring-4 focus:ring-[#667eea]/20 transition-all duration-300"
                />
              </div>
              <Button 
                onClick={handleSearch}
                className="bg-gradient-to-r from-[#667eea] to-[#764ba2] hover:from-[#5a6fd8] hover:to-[#6b4190] text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300"
              >
                <Search className="w-4 h-4 mr-2" />
                Buscar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Courses Table */}
        <Card className="shadow-xl border-0">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg">
            <CardTitle className="text-2xl font-bold text-gray-900 flex items-center">
              <BookOpen className="w-6 h-6 mr-2 text-[#667eea]" />
              Cursos Cadastrados
            </CardTitle>
            <CardDescription className="text-lg">
              {courses.length} curso{courses.length !== 1 ? 's' : ''} encontrado{courses.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {courses.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                  <BookOpen className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Nenhum curso encontrado
                </h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  {searchTerm ? 'Tente uma busca diferente ou ajuste os filtros.' : 'Comece criando um novo curso para oferecer aos seus alunos.'}
                </p>
                {!searchTerm && (
                  <Button 
                    onClick={() => router.push('/admin/courses/new')} 
                    className="bg-gradient-to-r from-[#667eea] to-[#764ba2] hover:from-[#5a6fd8] hover:to-[#6b4190] text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300"
                    size="lg"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Criar Primeiro Curso
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Reposição</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Turmas</TableHead>
                    <TableHead>Matrículas</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courses.map((course) => (
                    <TableRow key={course.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{course.name}</div>
                          {course.description && (
                            <div className="text-sm text-muted-foreground">
                              {course.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {course.duration ? `${course.duration}h` : '-'}
                      </TableCell>
                      <TableCell>{formatCurrency(course.price)}</TableCell>
                      <TableCell>
                        <Badge variant={course.allowsMakeup ? 'success' : 'secondary'}>
                          {course.allowsMakeup ? 'Sim' : 'Não'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={course.isActive ? 'success' : 'secondary'}>
                          {course.isActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          {course._count?.classes || 0}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          {course._count?.enrollments || 0}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(course.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            onClick={() => router.push(`/admin/courses/${course.id}/edit`)}
                            variant="outline"
                            size="sm"
                            className="border-[#667eea] text-[#667eea] hover:bg-[#667eea] hover:text-white transition-all duration-300"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => handleDelete(course.id, course.name)}
                            variant="outline"
                            size="sm"
                            className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
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
