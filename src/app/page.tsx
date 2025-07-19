'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, User, TrendingUp, Users, Calendar, MessageSquare, BarChart3, Settings, CheckSquare, BookOpen, Shield, Sparkles, Award, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { isSuperAdmin, isAdminOrSuperAdmin } from '@/lib/roles';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#667eea] to-[#764ba2]">
        <div className="text-center text-white">
          <Loader2 className="mx-auto animate-spin" size={48} />
          <p className="mt-4">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  const isAdmin = isAdminOrSuperAdmin(user);
  const isSuperAdminUser = isSuperAdmin(user);

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-2xl p-8 text-white shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                Bem-vindo de volta! 👋
              </h1>
              <p className="text-white/90 text-lg">
                {user.profile?.fullName || user.email}
              </p>
              <p className="text-white/70 text-sm mt-1">
                {isAdmin ? 'Administrador' : 'Usuário'} • {new Date().toLocaleDateString('pt-BR', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
            <div className="hidden md:block">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <User className="w-10 h-10" />
              </div>
            </div>
          </div>
        </div>

        {/* Admin Analytics & Insights */}
        {isAdmin && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total de Alunos</p>
                      <p className="text-3xl font-bold text-gray-900">156</p>
                      <p className="text-sm text-green-600 flex items-center mt-1">
                        <TrendingUp className="w-4 h-4 mr-1" />
                        +12% este mês
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-purple-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Turmas Ativas</p>
                      <p className="text-3xl font-bold text-gray-900">24</p>
                      <p className="text-sm text-green-600 flex items-center mt-1">
                        <Sparkles className="w-4 h-4 mr-1" />
                        8 novas turmas
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Calendar className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-green-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Taxa de Presença</p>
                      <p className="text-3xl font-bold text-gray-900">92%</p>
                      <p className="text-sm text-green-600 flex items-center mt-1">
                        <Award className="w-4 h-4 mr-1" />
                        Excelente!
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                      <CheckSquare className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-orange-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Próximas Aulas</p>
                      <p className="text-3xl font-bold text-gray-900">18</p>
                      <p className="text-sm text-blue-600 flex items-center mt-1">
                        <Clock className="w-4 h-4 mr-1" />
                        Hoje
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Advanced Analytics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Performance Chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2 text-purple-600" />
                    Performance das Turmas
                  </CardTitle>
                  <CardDescription>
                    Taxa de presença por turma nos últimos 30 dias
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { name: 'Matemática Avançada', attendance: 95, students: 28, color: 'bg-green-500' },
                      { name: 'Inglês Intermediário', attendance: 88, students: 22, color: 'bg-blue-500' },
                      { name: 'Física Básica', attendance: 91, students: 31, color: 'bg-purple-500' },
                      { name: 'Química Orgânica', attendance: 85, students: 19, color: 'bg-orange-500' },
                      { name: 'História Contemporânea', attendance: 92, students: 25, color: 'bg-indigo-500' },
                    ].map((class_, index) => (
                      <div key={index} className="flex items-center space-x-4">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-900">{class_.name}</span>
                            <span className="text-sm text-gray-600">{class_.attendance}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${class_.color}`}
                              style={{ width: `${class_.attendance}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500">{class_.students} alunos</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Insights */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <Shield className="w-5 h-5 mr-2 text-indigo-600" />
                      Alertas do Sistema
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm font-medium text-yellow-800">3 Alunos com Baixa Frequência</p>
                        <p className="text-xs text-yellow-700">Frequência abaixo de 75%</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                      <div className="w-2 h-2 bg-blue-400 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm font-medium text-blue-800">5 Novos Alunos Esta Semana</p>
                        <p className="text-xs text-blue-700">Aguardando primeira aula</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg border-l-4 border-green-400">
                      <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm font-medium text-green-800">WhatsApp Conectado</p>
                        <p className="text-xs text-green-700">Sistema funcionando normalmente</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                      Próximas Aulas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { time: '09:00', class: 'Matemática Avançada', students: 28 },
                        { time: '10:30', class: 'Inglês Intermediário', students: 22 },
                        { time: '14:00', class: 'Física Básica', students: 31 },
                        { time: '16:00', class: 'Química Orgânica', students: 19 },
                      ].map((lesson, index) => (
                        <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                          <div>
                            <p className="font-medium text-sm">{lesson.class}</p>
                            <p className="text-xs text-gray-600">{lesson.students} alunos</p>
                          </div>
                          <span className="text-sm font-medium text-gray-900">{lesson.time}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Ações Rápidas</CardTitle>
            <CardDescription>
              Acesse rapidamente as funcionalidades mais utilizadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isAdmin ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <Button
                  onClick={() => router.push('/admin/students/new')}
                  className="h-20 flex-col bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0"
                >
                  <Users className="w-6 h-6 mb-2" />
                  Novo Aluno
                </Button>
                <Button
                  onClick={() => router.push('/admin/classes/new')}
                  className="h-20 flex-col bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white border-0"
                >
                  <Calendar className="w-6 h-6 mb-2" />
                  Nova Turma
                </Button>
                <Button
                  onClick={() => router.push('/admin/attendance')}
                  className="h-20 flex-col bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white border-0"
                >
                  <CheckSquare className="w-6 h-6 mb-2" />
                  Presença
                </Button>
                <Button
                  onClick={() => router.push('/admin/reports')}
                  className="h-20 flex-col bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white border-0"
                >
                  <BarChart3 className="w-6 h-6 mb-2" />
                  Relatórios
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" disabled className="h-20 flex-col">
                  <CheckSquare className="w-6 h-6 mb-2" />
                  Marcar Presença
                  <span className="text-xs text-muted-foreground mt-1">Em breve</span>
                </Button>
                <Button variant="outline" disabled className="h-20 flex-col">
                  <Calendar className="w-6 h-6 mb-2" />
                  Minhas Aulas
                  <span className="text-xs text-muted-foreground mt-1">Em breve</span>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity - Admin Only */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Atividade Recente</CardTitle>
              <CardDescription>
                Últimas ações no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { action: 'Novo aluno cadastrado', user: 'Maria Silva', time: '5 min atrás', icon: Users, color: 'text-blue-600' },
                  { action: 'Presença registrada', user: 'Turma A - Matemática', time: '15 min atrás', icon: CheckSquare, color: 'text-green-600' },
                  { action: 'Nova turma criada', user: 'Inglês Avançado', time: '1 hora atrás', icon: Calendar, color: 'text-purple-600' },
                  { action: 'Relatório gerado', user: 'Frequência Mensal', time: '2 horas atrás', icon: BarChart3, color: 'text-orange-600' },
                ].map((activity, index) => (
                  <div key={index} className="flex items-center space-x-4 p-3 rounded-lg bg-gray-50">
                    <div className={`w-10 h-10 rounded-full bg-white flex items-center justify-center ${activity.color}`}>
                      <activity.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{activity.action}</p>
                      <p className="text-sm text-gray-600">{activity.user}</p>
                    </div>
                    <p className="text-sm text-gray-400">{activity.time}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
