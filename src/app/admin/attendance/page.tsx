'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckSquare, ArrowLeft, Construction } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AttendanceManagement() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.profile?.role !== 'admin')) {
      router.push('/');
      return;
    }
  }, [user, loading, router]);

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
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <Button onClick={() => router.push('/')} variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <CheckSquare className="w-8 h-8 mr-3" />
              Controle de Presença
            </h1>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Construction className="w-6 h-6 mr-2" />
              Em Desenvolvimento
            </CardTitle>
            <CardDescription>
              Esta funcionalidade está sendo desenvolvida
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center py-8">
            <Construction className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sistema de Controle de Presença</h3>
            <p className="text-muted-foreground mb-6">
              Em breve você poderá marcar presença dos alunos, usar reconhecimento facial,
              gerar relatórios de frequência e muito mais.
            </p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>✓ Modelo de dados implementado</p>
              <p>⏳ Interface de marcação</p>
              <p>⏳ Reconhecimento facial</p>
              <p>⏳ Lista de turmas do dia</p>
              <p>⏳ Marcação manual</p>
              <p>⏳ Indicador de reposição</p>
              <p>⏳ Feedback sonoro</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
