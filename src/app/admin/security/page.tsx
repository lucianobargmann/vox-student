'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Shield, AlertTriangle, Activity, Users, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface SecurityEvent {
  id: string;
  eventType: string;
  severity: string;
  description: string;
  timestamp: string;
  user?: {
    email: string;
    profile?: {
      fullName: string;
    };
  };
}

interface AuditLog {
  id: string;
  action: string;
  tableName: string;
  timestamp: string;
  user?: {
    email: string;
    profile?: {
      fullName: string;
    };
  };
}

interface DashboardData {
  summary: {
    totalSecurityEvents: number;
    totalAuditLogs: number;
    failedLoginAttempts: number;
    activeUsers: number;
  };
  statistics: {
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    actionsByType: Record<string, number>;
  };
  recentEvents: SecurityEvent[];
  recentAuditLogs: AuditLog[];
  failedLogins: SecurityEvent[];
}

export default function SecurityDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || !['admin', 'super_admin'].includes(user.profile?.role || ''))) {
      router.push('/');
      return;
    }

    if (user && ['admin', 'super_admin'].includes(user.profile?.role || '')) {
      fetchDashboardData();
    }
  }, [user, loading, router]);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/security/dashboard');
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const result = await response.json();
      setDashboardData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'secondary';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto animate-spin" size={48} />
          <p className="mt-4 text-muted-foreground">Carregando dashboard de segurança...</p>
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
            <Button onClick={fetchDashboardData} className="mt-4">
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
              <Shield className="w-8 h-8 mr-3" />
              Dashboard de Segurança
            </h1>
          </div>
        </div>

        {dashboardData && (
          <>
            {/* Summary Cards */}
            <div className="grid gap-6 md:grid-cols-4 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Eventos de Segurança</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardData.summary.totalSecurityEvents}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Logs de Auditoria</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardData.summary.totalAuditLogs}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tentativas de Login Falharam</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{dashboardData.summary.failedLoginAttempts}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardData.summary.activeUsers}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2 mb-8">
              {/* Recent Security Events */}
              <Card>
                <CardHeader>
                  <CardTitle>Eventos de Segurança Recentes</CardTitle>
                  <CardDescription>Últimos 20 eventos de segurança</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Severidade</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboardData.recentEvents.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="font-medium">{event.eventType}</TableCell>
                          <TableCell>
                            <Badge variant={getSeverityBadgeVariant(event.severity)}>
                              {event.severity}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {event.user?.profile?.fullName || event.user?.email || 'Sistema'}
                          </TableCell>
                          <TableCell>{formatDate(event.timestamp)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Recent Audit Logs */}
              <Card>
                <CardHeader>
                  <CardTitle>Logs de Auditoria Recentes</CardTitle>
                  <CardDescription>Últimas 20 ações de auditoria</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ação</TableHead>
                        <TableHead>Tabela</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboardData.recentAuditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium">{log.action}</TableCell>
                          <TableCell>{log.tableName}</TableCell>
                          <TableCell>
                            {log.user?.profile?.fullName || log.user?.email || 'Sistema'}
                          </TableCell>
                          <TableCell>{formatDate(log.timestamp)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
