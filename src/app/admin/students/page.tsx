'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Users, ArrowLeft, Plus, Search, Edit, Trash2, Mail, Phone, Eye, Camera } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { canManageStudents } from '@/lib/roles';
import { FaceRegistration } from '@/components/FaceRegistration';

import { useEffect, useState } from 'react';

interface Student {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  status: string;
  registrationDate: string;
  faceDescriptor?: string;
  photoUrl?: string;
  faceDataUpdatedAt?: string;
  _count?: {
    attendance: number;
    enrollments: number;
  };
  enrollments?: Array<{
    course: {
      name: string;
    };
    class?: {
      name: string;
    };
  }>;
}

export default function StudentsManagement() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [faceRegistrationOpen, setFaceRegistrationOpen] = useState(false);
  const { showConfirmation, ConfirmationDialog } = useConfirmationDialog();

  useEffect(() => {
    if (!loading && !canManageStudents(user)) {
      router.push('/');
      return;
    }

    if (canManageStudents(user)) {
      fetchStudents();
    }
  }, [user, loading]);

  const fetchStudents = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const url = searchTerm
        ? `/api/students?search=${encodeURIComponent(searchTerm)}`
        : '/api/students';

      const token = localStorage.getItem('auth_token');
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Falha ao carregar alunos');
      }

      const result = await response.json();
      setStudents(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    fetchStudents();
  };

  const handleDelete = (studentId: string, studentName: string) => {
    showConfirmation({
      title: 'Excluir Aluno',
      description: `Tem certeza que deseja excluir o aluno "${studentName}"? Esta ação não pode ser desfeita.`,
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

          const response = await fetch(`/api/students/${studentId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete student');
          }

          toast.success('Aluno excluído com sucesso!');
          // Refresh the list
          fetchStudents();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Erro ao excluir aluno');
        }
      }
    });
  };

  const handleFaceRegistration = (student: Student) => {
    setSelectedStudent(student);
    setFaceRegistrationOpen(true);
  };

  const handleFaceRegistrationComplete = (studentId: string) => {
    // Reload students data to get updated face information
    fetchStudents();
    setFaceRegistrationOpen(false);
    setSelectedStudent(null);
    toast.success('Dados faciais atualizados com sucesso!');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'secondary';
      case 'suspended':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Ativo';
      case 'inactive':
        return 'Inativo';
      case 'suspended':
        return 'Suspenso';
      default:
        return status;
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto animate-spin" size={48} />
          <p className="mt-4 text-muted-foreground">Carregando alunos...</p>
        </div>
      </div>
    );
  }

  if (!canManageStudents(user)) {
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
            <Button onClick={fetchStudents} className="mt-4">
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
              <Users className="w-8 h-8 mr-3" />
              Gerenciar Alunos
            </h1>
          </div>
          <Button onClick={() => router.push('/admin/students/new')}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Aluno
          </Button>
        </div>



        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Buscar alunos por nome, email ou telefone..."
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

        {/* Students Table */}
        <Card>
          <CardHeader>
            <CardTitle>Alunos Cadastrados</CardTitle>
            <CardDescription>
              {students.length} aluno{students.length !== 1 ? 's' : ''} encontrado{students.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold text-foreground">
                  Nenhum aluno encontrado
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchTerm ? 'Tente uma busca diferente.' : 'Comece cadastrando um novo aluno.'}
                </p>
                {!searchTerm && (
                  <Button onClick={() => router.push('/admin/students/new')} className="mt-4">
                    <Plus className="w-4 h-4 mr-2" />
                    Cadastrar Primeiro Aluno
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Matrículas</TableHead>
                    <TableHead>Presenças</TableHead>
                    <TableHead>Cadastrado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{student.name}</span>
                            {student.faceDescriptor && (
                              <Badge variant="outline" className="text-blue-600 text-xs">
                                <Camera className="w-3 h-3 mr-1" />
                                Face
                              </Badge>
                            )}
                          </div>
                          {student.birthDate && (
                            <div className="text-sm text-muted-foreground">
                              Nascimento: {formatDate(student.birthDate)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {student.email && (
                            <div className="flex items-center text-sm">
                              <Mail className="w-3 h-3 mr-1" />
                              {student.email}
                            </div>
                          )}
                          {student.phone && (
                            <div className="flex items-center text-sm">
                              <Phone className="w-3 h-3 mr-1" />
                              {student.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(student.status)}>
                          {getStatusLabel(student.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{student._count?.enrollments || 0} curso{(student._count?.enrollments || 0) !== 1 ? 's' : ''}</div>
                          {student.enrollments && student.enrollments.length > 0 && (
                            <div className="text-muted-foreground">
                              {student.enrollments.slice(0, 2).map(e => e.course.name).join(', ')}
                              {student.enrollments.length > 2 && '...'}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{student._count?.attendance || 0}</TableCell>
                      <TableCell>{formatDate(student.registrationDate)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            onClick={() => router.push(`/admin/students/${student.id}`)}
                            variant="outline"
                            size="sm"
                            title="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => router.push(`/admin/students/${student.id}/edit`)}
                            variant="outline"
                            size="sm"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => handleFaceRegistration(student)}
                            variant="outline"
                            size="sm"
                            title={student.faceDescriptor ? "Atualizar dados faciais" : "Cadastrar dados faciais"}
                            className={student.faceDescriptor ? "text-blue-600 hover:text-blue-700" : "text-gray-600 hover:text-gray-700"}
                          >
                            <Camera className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => handleDelete(student.id, student.name)}
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
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmationDialog />

      {/* Face Registration Modal */}
      {selectedStudent && (
        <FaceRegistration
          student={selectedStudent}
          open={faceRegistrationOpen}
          onOpenChange={setFaceRegistrationOpen}
          onRegistrationComplete={handleFaceRegistrationComplete}
        />
      )}
    </div>
  );
}
