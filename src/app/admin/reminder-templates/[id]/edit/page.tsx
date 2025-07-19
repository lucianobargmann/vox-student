'use client';

import { use, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, MessageSquare, ArrowLeft, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { isAdminOrSuperAdmin } from '@/lib/roles';
import { templatesService, ReminderTemplate } from '@/lib/services/templates.service';

export default function EditReminderTemplate({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const [template, setTemplate] = useState<ReminderTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

    if (isAdminOrSuperAdmin(user)) {
      fetchTemplate();
    }
  }, [user, loading, router]);

  const fetchTemplate = async () => {
    try {
      setIsLoading(true);
      const response = await templatesService.getTemplate(resolvedParams.id);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch template');
      }

      const templateData = response.data!;
      setTemplate(templateData);
      
      // Populate form
      setFormData({
        name: templateData.name || '',
        category: templateData.category || '',
        template: templateData.template || '',
        description: templateData.description || '',
        isActive: templateData.isActive !== undefined ? templateData.isActive : true
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
      toast.error('Nome é obrigatório');
      return;
    }

    if (!formData.template.trim()) {
      toast.error('Template de mensagem é obrigatório');
      return;
    }

    try {
      setIsSaving(true);
      const response = await templatesService.updateTemplate(resolvedParams.id, {
        name: formData.name.trim(),
        category: formData.category.trim() || undefined,
        template: formData.template.trim(),
        description: formData.description.trim() || undefined,
        isActive: formData.isActive
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to update template');
      }

      toast.success('Template atualizado com sucesso!');
      router.push('/admin/reminder-templates');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar template');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto animate-spin" size={48} />
          <p className="mt-4 text-muted-foreground">Carregando template...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdminOrSuperAdmin(user)) {
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
            <Button onClick={() => router.push('/admin/reminder-templates')} className="mt-4">
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
          <Button onClick={() => router.push('/admin/reminder-templates')} variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <MessageSquare className="w-8 h-8 mr-3" />
            Editar Template
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Editar Template de Lembrete</CardTitle>
            <CardDescription>
              Edite as informações do template {template?.name}
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
                  Use variáveis como: {`{{nome_do_aluno}}, {{nome_curso}}, {{data_aula}}, {{hora_inicio_aula}}, {{nome_professor}}, {{local_aula}}`}
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
      </div>
    </div>
  );
}
