'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, User, LogOut, Shield, BookOpen, Users, Calendar, MessageSquare, BarChart3, Settings, CheckSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
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

  if (!user) {
    router.push('/login');
    return null;
  }

  const isAdmin = user.profile?.role === 'admin' || user.profile?.role === 'super_admin';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">VoxStudent - Dashboard</h1>
          <Button onClick={handleSignOut} variant="outline">
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>

        <div className="grid gap-6 mb-8">
          {/* User Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="w-5 h-5 mr-2" />
                Informações do Usuário
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{user.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-medium">{user.profile?.fullName || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Função</p>
                  <p className="font-medium capitalize">{user.profile?.role || 'user'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Admin Dashboard */}
          {isAdmin && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Shield className="w-5 h-5 mr-2" />
                    Painel Administrativo
                  </CardTitle>
                  <CardDescription>
                    Gerencie todos os aspectos do sistema VoxStudent
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {/* Cadastros Básicos */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Cadastros</h3>
                      <Button
                        onClick={() => router.push('/admin/courses')}
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <BookOpen className="w-4 h-4 mr-2" />
                        Cursos
                      </Button>
                      <Button
                        onClick={() => router.push('/admin/classes')}
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        Turmas
                      </Button>
                      <Button
                        onClick={() => router.push('/admin/students')}
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <Users className="w-4 h-4 mr-2" />
                        Alunos
                      </Button>
                      <Button
                        onClick={() => router.push('/admin/reminder-templates')}
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Templates de Lembrete
                      </Button>
                    </div>

                    {/* Operações */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Operações</h3>
                      <Button
                        onClick={() => router.push('/admin/attendance')}
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <CheckSquare className="w-4 h-4 mr-2" />
                        Controle de Presença
                      </Button>
                      <Button
                        onClick={() => router.push('/admin/reports')}
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Relatórios
                      </Button>
                    </div>

                    {/* Segurança */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Segurança</h3>
                      <Button
                        onClick={() => router.push('/admin/security')}
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        Dashboard de Segurança
                      </Button>
                    </div>

                    {/* Configurações */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Sistema</h3>
                      <Button
                        onClick={() => router.push('/admin/settings')}
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Configurações
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Regular User Dashboard */}
          {!isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>Bem-vindo ao VoxStudent!</CardTitle>
                <CardDescription>
                  Sistema de Gestão Educacional
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Você está autenticado como usuário. Entre em contato com o administrador para obter acesso a funcionalidades adicionais.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <Button variant="outline" disabled>
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Marcar Presença
                  </Button>
                  <Button variant="outline" disabled>
                    <Calendar className="w-4 h-4 mr-2" />
                    Minhas Aulas
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            VoxStudent &copy; 2025 - Sistema de Gestão Educacional
          </p>
        </div>
      </div>
    </div>
  );
}
