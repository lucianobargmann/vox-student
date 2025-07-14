'use client';

import { use, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, Calendar, ArrowLeft, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { canManageClasses } from '@/lib/roles';
import { ClassEnrollmentsManager } from '@/components/ClassEnrollmentsManager';

interface Course {
  id: string;
  name: string;
}

interface Class {
  id: string;
  name: string;
  description?: string;
  courseId: string;
  startDate: string;
  endDate?: string;
  maxStudents?: number;
  isActive: boolean;
  course: {
    id: string;
    name: string;
  };
}

export default function EditClass({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const [classData, setClassData] = useState<Class | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    courseId: '',
    startDate: '',
    endDate: '',
    maxStudents: '',
    isActive: true
  });

  useEffect(() => {
    if (!loading && !canManageClasses(user)) {
      router.push('/');
      return;
    }

    if (canManageClasses(user)) {
      fetchData();
    }
  }, [user, loading, router]);

  const fetchData = async () => {
    try {
      setIsLoading(true);

      // Get token from localStorage
      const token = localStorage.getItem('auth_token');

      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Fetch courses and class data in parallel
      const [coursesResponse, classResponse] = await Promise.all([
        fetch('/api/courses', { headers }),
        fetch(`/api/classes/${resolvedParams.id}`, { headers })
      ]);

      if (!coursesResponse.ok || !classResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      const [coursesResult, classResult] = await Promise.all([
        coursesResponse.json(),
        classResponse.json()
      ]);

      setCourses(coursesResult.data);
      const classData = classResult.data;
      setClassData(classData);
      
      // Populate form
      setFormData({
        name: classData.name || '',
        description: classData.description || '',
        courseId: classData.courseId || '',
        startDate: classData.startDate ? classData.startDate.split('T')[0] : '',
        endDate: classData.endDate ? classData.endDate.split('T')[0] : '',
        maxStudents: classData.maxStudents ? classData.maxStudents.toString() : '',
        isActive: classData.isActive !== undefined ? classData.isActive : true
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Nome da turma é obrigatório');
      return;
    }

    if (!formData.courseId) {
      toast.error('Curso é obrigatório');
      return;
    }

    if (!formData.startDate) {
      toast.error('Data de início é obrigatória');
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

      const response = await fetch(`/api/classes/${resolvedParams.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          courseId: formData.courseId,
          startDate: formData.startDate,
          endDate: formData.endDate || null,
          maxStudents: formData.maxStudents ? parseInt(formData.maxStudents) : null,
          isActive: formData.isActive
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update class');
      }

      toast.success('Turma atualizada com sucesso!');
      router.push('/admin/classes');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar turma');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto animate-spin" size={48} />
          <p className="mt-4 text-muted-foreground">Carregando turma...</p>
        </div>
      </div>
    );
  }

  if (!canManageClasses(user)) {
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
            <Button onClick={() => router.push('/admin/classes')} className="mt-4">
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
        <div className="flex items-center space-x-4 mb-8">
          <Button onClick={() => router.push('/admin/classes')} variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Calendar className="w-8 h-8 mr-3" />
            Editar Turma
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Editar Turma</CardTitle>
            <CardDescription>
              Edite as informações da turma {classData?.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Turma *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Turma A - Manhã"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="courseId">Curso *</Label>
                  <Select value={formData.courseId} onValueChange={(value) => setFormData({ ...formData, courseId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um curso" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="startDate">Data de Início *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">Data de Término</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxStudents">Máximo de Alunos</Label>
                  <Input
                    id="maxStudents"
                    type="number"
                    min="1"
                    value={formData.maxStudents}
                    onChange={(e) => setFormData({ ...formData, maxStudents: e.target.value })}
                    placeholder="Ex: 20"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição da turma..."
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive">Turma ativa</Label>
              </div>

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/admin/classes')}
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

        {/* Student Management Section */}
        {classData && (
          <div className="mt-8">
            <ClassEnrollmentsManager
              classId={resolvedParams.id}
              courseId={classData.courseId}
              className={classData.name}
              courseName={classData.course?.name || 'Curso'}
              maxStudents={classData.maxStudents || undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}
