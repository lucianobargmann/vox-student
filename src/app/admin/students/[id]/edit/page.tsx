'use client';

import { use, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Users, ArrowLeft, Save, Camera } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { canManageStudents } from '@/lib/roles';
import { FaceRegistration } from '@/components/FaceRegistration';

interface Student {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  notes?: string;
  status: string;
  faceDescriptor?: string;
  photoUrl?: string;
  faceDataUpdatedAt?: string;
}

export default function EditStudent({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faceRegistrationOpen, setFaceRegistrationOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    birthDate: '',
    notes: '',
    status: 'active'
  });

  useEffect(() => {
    if (!loading && !canManageStudents(user)) {
      router.push('/');
      return;
    }

    if (canManageStudents(user)) {
      fetchStudent();
    }
  }, [user, loading]);

  const fetchStudent = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/students/${resolvedParams.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Falha ao carregar aluno');
      }

      const result = await response.json();
      const studentData = result.data;
      setStudent(studentData);

      // Populate form
      setFormData({
        name: studentData.name || '',
        email: studentData.email || '',
        phone: studentData.phone || '',
        birthDate: studentData.birthDate ? studentData.birthDate.split('T')[0] : '',
        notes: studentData.notes || '',
        status: studentData.status || 'active'
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Nome é obrigatório');
      return;
    }

    try {
      setIsSaving(true);
      const token = localStorage.getItem('auth_token');

      if (!token) {
        toast.error('Sessão expirada. Faça login novamente.');
        router.push('/login');
        return;
      }

      const response = await fetch(`/api/students/${resolvedParams.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          birthDate: formData.birthDate || null,
          notes: formData.notes.trim() || null,
          status: formData.status
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Falha ao atualizar aluno');
      }

      toast.success('Aluno atualizado com sucesso!');
      router.push('/admin/students');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar aluno');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFaceRegistrationComplete = (studentId: string) => {
    // Reload student data to get updated face information
    fetchStudent();
    toast.success('Dados faciais atualizados com sucesso!');
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto animate-spin" size={48} />
          <p className="mt-4 text-muted-foreground">Carregando aluno...</p>
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
            <Button onClick={() => router.push('/admin/students')} className="mt-4">
              Voltar para Lista
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <Button onClick={() => router.push('/admin/students')} variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Users className="w-8 h-8 mr-3" />
              Editar Aluno
            </h1>
          </div>

          {student && (
            <Button
              onClick={() => setFaceRegistrationOpen(true)}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <Camera className="w-4 h-4" />
              <span>{student.faceDescriptor ? 'Atualizar Face' : 'Cadastrar Face'}</span>
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informações do Aluno</CardTitle>
            <CardDescription>
              Edite as informações do aluno {student?.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome completo do aluno"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                      <SelectItem value="suspended">Suspenso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(11) 99999-9999"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="birthDate">Data de Nascimento</Label>
                  <Input
                    id="birthDate"
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Observações sobre o aluno..."
                  rows={3}
                />
              </div>

              {/* Face Recognition Info */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 flex items-center">
                      <Camera className="w-5 h-5 mr-2" />
                      Reconhecimento Facial
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {student?.faceDescriptor
                        ? `Dados faciais cadastrados em ${new Date(student.faceDataUpdatedAt!).toLocaleDateString('pt-BR')}`
                        : 'Cadastre os dados faciais para reconhecimento automático na presença'
                      }
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {student?.faceDescriptor ? (
                      <div className="flex items-center text-green-600 text-sm">
                        <div className="w-2 h-2 bg-green-600 rounded-full mr-2"></div>
                        Cadastrado
                      </div>
                    ) : (
                      <div className="flex items-center text-gray-500 text-sm">
                        <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                        Não cadastrado
                      </div>
                    )}
                    <Button
                      type="button"
                      onClick={() => setFaceRegistrationOpen(true)}
                      variant="outline"
                      size="sm"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      {student?.faceDescriptor ? 'Atualizar' : 'Cadastrar'}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/admin/students')}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Salvar Alterações
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Face Registration Modal */}
        {student && (
          <FaceRegistration
            student={student}
            open={faceRegistrationOpen}
            onOpenChange={setFaceRegistrationOpen}
            onRegistrationComplete={handleFaceRegistrationComplete}
          />
        )}
      </div>
    </div>
  );
}
