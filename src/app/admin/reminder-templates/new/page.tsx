'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, MessageSquare, ArrowLeft, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { templatesService } from '@/lib/services/templates.service';
import { isAdminOrSuperAdmin } from '@/lib/roles';

export default function NewReminderTemplate() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    template: '',
    description: '',
    isActive: true
  });

  useEffect(() => {
    if (!loading && !isAdminOrSuperAdmin(user)) {
      router.push('/');
      return;
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    if (!formData.template.trim()) {
      toast.error('Template de mensagem é obrigatório');
      return;
    }

    try {
      setIsSaving(true);
      const response = await templatesService.createTemplate({
        name: formData.name.trim(),
        category: formData.category.trim() || undefined,
        template: formData.template.trim(),
        description: formData.description.trim() || undefined,
        isActive: formData.isActive
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to create template');
      }

      toast.success('Template criado com sucesso!');
      router.push('/admin/reminder-templates');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar template');
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

  if (!user || user.profile?.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full">
        <div className="flex items-center space-x-4 mb-8">
          <Button onClick={() => router.push('/admin/reminder-templates')} variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <MessageSquare className="w-8 h-8 mr-3" />
            Novo Template de Lembrete
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Criar Template</CardTitle>
            <CardDescription>
              Crie um novo template de lembrete para ser usado no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Template *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Lembrete Aula Amanhã"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Categoria (opcional)</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Ex: aula, mentoria, reposicao"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ex: Enviado para alunos 24h antes da aula"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="template">Template de Mensagem *</Label>
                <Textarea
                  id="template"
                  value={formData.template}
                  onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                  placeholder="Olá {{nome_do_aluno}}, você tem uma {{tipo_evento}} marcada para {{data}} às {{hora}}. Local: {{local}}. Não esqueça!"
                  rows={6}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Use variáveis como: {`{{nome_do_aluno}}, {{nome_curso}}, {{data_aula}}, {{hora_aula}}, {{nome_professor}}, {{local_aula}}`}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive">Template ativo</Label>
              </div>

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/admin/reminder-templates')}
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
                      Criar Template
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
