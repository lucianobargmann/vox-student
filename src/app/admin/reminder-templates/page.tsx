'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, MessageSquare, ArrowLeft, Plus, Search, Edit, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useEffect, useState } from 'react';
import { templatesService, ReminderTemplate } from '@/lib/services/templates.service';
import { isAdminOrSuperAdmin } from '@/lib/roles';

export default function ReminderTemplatesManagement() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { showConfirmation, ConfirmationDialog } = useConfirmationDialog();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isAdminOrSuperAdmin(user)) {
      router.push('/');
      return;
    }

    if (isAdminOrSuperAdmin(user)) {
      fetchTemplates();
    }
  }, [user, loading]);

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const response = await templatesService.getTemplates(searchTerm);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch reminder templates');
      }

      setTemplates(response.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (templateId: string, templateName: string) => {
    showConfirmation({
      title: 'Excluir Template',
      description: `Tem certeza que deseja excluir o template "${templateName}"? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
      icon: 'delete',
      onConfirm: async () => {
        try {
          const response = await templatesService.deleteTemplate(templateId);

          if (!response.success) {
            throw new Error(response.error || 'Failed to delete template');
          }

          toast.success('Template excluído com sucesso!');
          // Refresh the list
          fetchTemplates();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Erro ao excluir template');
        }
      }
    });
  };

  const getCategoryBadgeVariant = (category?: string) => {
    if (!category) return 'secondary';
    switch (category.toLowerCase()) {
      case 'aula':
        return 'info';
      case 'mentoria':
        return 'warning';
      case 'reposicao':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getCategoryLabel = (category?: string) => {
    if (!category) return 'Sem categoria';
    switch (category.toLowerCase()) {
      case 'aula':
        return 'Aula';
      case 'mentoria':
        return 'Mentoria';
      case 'reposicao':
        return 'Reposição';
      default:
        return category;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto animate-spin" size={48} />
          <p className="mt-4 text-muted-foreground">Carregando templates...</p>
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
            <Button onClick={fetchTemplates} className="mt-4">
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
              <MessageSquare className="w-8 h-8 mr-3" />
              Templates de Lembrete
            </h1>
          </div>
          <Button onClick={() => router.push('/admin/reminder-templates/new')}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Template
          </Button>
        </div>

        {/* Templates Table */}
        <Card>
          <CardHeader>
            <CardTitle>Templates Cadastrados</CardTitle>
            <CardDescription>
              {templates.length} template{templates.length !== 1 ? 's' : ''} encontrado{templates.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {templates.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold text-foreground">
                  Nenhum template encontrado
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Comece criando um novo template de lembrete.
                </p>
                <Button onClick={() => router.push('/admin/reminder-templates/new')} className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeiro Template
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>
                        <Badge variant={getCategoryBadgeVariant(template.category)}>
                          {getCategoryLabel(template.category)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate text-sm text-muted-foreground">
                          {template.template}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={template.isActive ? 'success' : 'secondary'}>
                          {template.isActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(template.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            onClick={() => router.push(`/admin/reminder-templates/${template.id}/edit`)}
                            variant="outline"
                            size="sm"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => handleDelete(template.id, template.name)}
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
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
