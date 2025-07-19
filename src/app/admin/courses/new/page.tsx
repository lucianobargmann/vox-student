'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, BookOpen, ArrowLeft, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { coursesService } from '@/lib/services/courses.service';
import { toast } from 'sonner';

interface CourseFormData {
  name: string;
  description: string;
  duration: string;
  numberOfLessons: string;
  price: string;
  allowsMakeup: boolean;
}

export default function NewCourse() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState<CourseFormData>({
    name: '',
    description: '',
    duration: '',
    numberOfLessons: '',
    price: '',
    allowsMakeup: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || !['admin', 'super_admin'].includes(user.profile?.role || ''))) {
      router.push('/');
      return;
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await coursesService.createCourse({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        duration: formData.duration ? parseInt(formData.duration) : undefined
      });

      if (!response.success) {
        throw new Error(response.error || 'Falha ao criar curso');
      }

      toast.success('Curso criado com sucesso!');
      router.push('/admin/courses');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof CourseFormData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
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

  if (!user || !['admin', 'super_admin'].includes(user.profile?.role || '')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-2xl p-8 text-white shadow-xl mb-8">
          <div className="flex items-center space-x-4">
            <Button onClick={() => router.push('/admin/courses')} variant="outline" size="sm" className="bg-white/20 text-white border-white/30 hover:bg-white/30">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center">
                <BookOpen className="w-8 h-8 mr-3" />
                Novo Curso
              </h1>
              <p className="text-white/90">
                Crie um novo curso para oferecer aos seus alunos
              </p>
            </div>
          </div>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg">
            <CardTitle className="text-2xl font-bold text-gray-900 flex items-center">
              <BookOpen className="w-6 h-6 mr-2 text-[#667eea]" />
              Criar Novo Curso
            </CardTitle>
            <CardDescription className="text-lg">
              Preencha as informações do curso que será oferecido aos alunos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md">
                  {error}
                </div>
              )}

              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium">
                    Nome do Curso *
                  </label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Ex: Academy, Master, Intensivox..."
                    required
                    className="border-2 border-gray-200 focus:border-[#667eea] focus:ring-4 focus:ring-[#667eea]/20 transition-all duration-300"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="duration" className="text-sm font-medium">
                    Duração (horas)
                  </label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    value={formData.duration}
                    onChange={(e) => handleInputChange('duration', e.target.value)}
                    placeholder="Ex: 40"
                    className="border-2 border-gray-200 focus:border-[#667eea] focus:ring-4 focus:ring-[#667eea]/20 transition-all duration-300"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="numberOfLessons" className="text-sm font-medium">
                    Número de Aulas
                  </label>
                  <Input
                    id="numberOfLessons"
                    type="number"
                    min="1"
                    value={formData.numberOfLessons}
                    onChange={(e) => handleInputChange('numberOfLessons', e.target.value)}
                    placeholder="Ex: 12"
                    className="border-2 border-gray-200 focus:border-[#667eea] focus:ring-4 focus:ring-[#667eea]/20 transition-all duration-300"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium">
                  Descrição
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Descrição detalhada do curso..."
                  className="w-full min-h-[100px] px-3 py-2 border-2 border-gray-200 focus:border-[#667eea] focus:ring-4 focus:ring-[#667eea]/20 transition-all duration-300 bg-background rounded-md text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="price" className="text-sm font-medium">
                    Preço (R$)
                  </label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => handleInputChange('price', e.target.value)}
                    placeholder="Ex: 299.90"
                    className="border-2 border-gray-200 focus:border-[#667eea] focus:ring-4 focus:ring-[#667eea]/20 transition-all duration-300"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Configurações</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="allowsMakeup"
                      checked={formData.allowsMakeup}
                      onChange={(e) => handleInputChange('allowsMakeup', e.target.checked)}
                      className="rounded border-input"
                    />
                    <label htmlFor="allowsMakeup" className="text-sm">
                      Permite reposição de aulas
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/admin/courses')}
                  className="border-gray-300 text-gray-700 hover:bg-gray-50 transition-all duration-300"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-[#667eea] to-[#764ba2] hover:from-[#5a6fd8] hover:to-[#6b4190] text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:transform-none"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Salvar Curso
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
