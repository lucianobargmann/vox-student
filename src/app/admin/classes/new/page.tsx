'use client';

import { useState, useEffect } from 'react';
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

interface Course {
  id: string;
  name: string;
  numberOfLessons?: number;
}

export default function NewClass() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    courseId: '',
    startDate: '',
    endDate: '',
    classTime: '19:00',
    maxStudents: '',
    isActive: true
  });

  // Function to calculate end date based on start date and number of lessons
  const calculateEndDate = (startDate: string, courseId: string): string => {
    if (!startDate || !courseId) return '';

    const course = courses.find(c => c.id === courseId);
    if (!course?.numberOfLessons) return '';

    const start = new Date(startDate);
    // Add (numberOfLessons - 1) weeks to get the end date
    // Subtract 1 because the first lesson is on the start date
    const endDate = new Date(start);
    endDate.setDate(start.getDate() + ((course.numberOfLessons - 1) * 7));

    return endDate.toISOString().split('T')[0];
  };

  // Handle form data changes with auto-calculation
  const handleFormChange = (field: string, value: any) => {
    const newFormData = { ...formData, [field]: value };

    // Auto-calculate end date when start date or course changes
    if (field === 'startDate' || field === 'courseId') {
      const endDate = calculateEndDate(
        field === 'startDate' ? value : formData.startDate,
        field === 'courseId' ? value : formData.courseId
      );
      newFormData.endDate = endDate;
    }

    setFormData(newFormData);
  };

  const fetchCourses = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('auth_token');

      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/courses', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch courses');
      }

      const result = await response.json();
      setCourses(result.data);
    } catch (err) {
      console.error('Error fetching courses:', err);
      toast.error('Erro ao carregar cursos. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && !canManageClasses(user)) {
      router.push('/');
      return;
    }

    if (canManageClasses(user)) {
      fetchCourses();
    }
  }, [user, loading]);

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

      const response = await fetch('/api/classes', {
        method: 'POST',
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
          classTime: formData.classTime,
          maxStudents: formData.maxStudents ? parseInt(formData.maxStudents) : null,
          isActive: formData.isActive
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create class');
      }

      toast.success('Turma criada com sucesso!');
      router.push('/admin/classes');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar turma');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto animate-spin" size={48} />
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!canManageClasses(user)) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto animate-spin" size={48} />
          <p className="mt-4 text-muted-foreground">Carregando cursos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full">
        <div className="flex items-center space-x-4 mb-8">
          <Button onClick={() => router.push('/admin/classes')} variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Calendar className="w-8 h-8 mr-3" />
            Nova Turma
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Criar Nova Turma</CardTitle>
            <CardDescription>
              Crie uma nova turma para um curso existente
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
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    placeholder="Ex: Turma A - Manhã"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="courseId">Curso *</Label>
                  <Select value={formData.courseId} onValueChange={(value) => handleFormChange('courseId', value)}>
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
                    onChange={(e) => handleFormChange('startDate', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">Data de Término</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => handleFormChange('endDate', e.target.value)}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Calculado automaticamente baseado no número de aulas do curso
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="classTime">Horário da Aula</Label>
                  <Input
                    id="classTime"
                    type="time"
                    value={formData.classTime}
                    onChange={(e) => handleFormChange('classTime', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxStudents">Máximo de Alunos</Label>
                  <Input
                    id="maxStudents"
                    type="number"
                    min="1"
                    value={formData.maxStudents}
                    onChange={(e) => handleFormChange('maxStudents', e.target.value)}
                    placeholder="Ex: 20"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  placeholder="Descrição da turma..."
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => handleFormChange('isActive', checked)}
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
                      Criando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Criar Turma
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
