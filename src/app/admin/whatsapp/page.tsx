'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  MessageSquare, 
  ArrowLeft, 
  Send, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock,
  Users,
  BarChart3,
  Settings,
  Play
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { WhatsAppQRCode } from '@/components/WhatsAppQRCode';
import { whatsappService, WhatsAppStatus } from '@/lib/services/whatsapp.service';

interface QueueStats {
  totalMessages: number;
  pendingMessages: number;
  processingMessages: number;
  sentMessages: number;
  failedMessages: number;
  successRate: string;
}

export default function WhatsAppAdmin() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [testMessage, setTestMessage] = useState({
    phoneNumber: '',
    message: 'Olá! Esta é uma mensagem de teste do VoxStudent. 📱'
  });

  // Redirect if not admin
  useEffect(() => {
    if (!loading && (!user || !['admin', 'super_admin'].includes(user.profile?.role || ''))) {
      router.push('/');
      return;
    }

    if (user && ['admin', 'super_admin'].includes(user.profile?.role || '')) {
      loadData();
    }
  }, [user, loading]);

  // Auto-refresh when WhatsApp is initializing to catch QR code
  useEffect(() => {
    let interval: NodeJS.Timeout;

    // Only poll if initializing OR (enabled but not ready and no QR code)
    const shouldPoll = whatsappStatus?.connection?.isInitializing || 
                      (whatsappStatus?.settings?.enabled && 
                       !whatsappStatus?.connection?.isReady && 
                       !whatsappStatus?.connection?.qrCode);

    if (shouldPoll) {
      console.log('🔍 Starting polling for WhatsApp status');
      interval = setInterval(() => {
        loadData();
      }, 3000); // Check every 3 seconds
    } else {
      console.log('🔍 Stopping polling - WhatsApp is ready or has QR code');
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [whatsappStatus?.connection?.isInitializing, whatsappStatus?.settings?.enabled, whatsappStatus?.connection?.isReady, whatsappStatus?.connection?.qrCode]);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Load WhatsApp status
      const statusResponse = await whatsappService.getStatus();
      if (statusResponse.success && statusResponse.data) {
        setWhatsappStatus(statusResponse.data);
      }

      // Load queue data
      try {
        const queueResponse = await whatsappService.getQueue();
        if (queueResponse.success && queueResponse.data) {
          setQueueStats(queueResponse.data.statistics);
        }
      } catch (queueError) {
        console.error('Error loading queue data:', queueError);
      }

    } catch (error) {
      console.error('Error loading WhatsApp data:', error);
      toast.error('Erro ao carregar dados do WhatsApp');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWhatsAppAction = async (action: 'verify' | 'restart') => {
    try {
      console.log('🔍 Frontend: Calling WhatsApp action:', action);
      const response = await whatsappService.performAction(action);
      console.log('🔍 Frontend: WhatsApp action response:', response);

      if (!response.success) {
        throw new Error(response.error || `Erro ao ${action === 'verify' ? 'verificar' : 'reiniciar'} WhatsApp`);
      }

      if (response.data?.message) {
        toast.success(response.data.message);
      }

      await loadData(); // Reload data

    } catch (error) {
      console.error(`Error ${action} WhatsApp:`, error);
      toast.error(error instanceof Error ? error.message : `Erro ao ${action === 'verify' ? 'verificar' : 'reiniciar'} WhatsApp`);
    }
  };

  const handleEnableWhatsApp = async () => {
    try {
      // Debug: Check if user is authenticated
      const token = localStorage.getItem('auth_token');
      if (!token) {
        toast.error('Você precisa estar logado para habilitar o WhatsApp');
        router.push('/login');
        return;
      }

      // First, enable WhatsApp in settings
      const response = await whatsappService.updateSettings({
        enabled: true,
        rateLimitSeconds: 30
      });

      if (!response.success) {
        throw new Error(response.error || 'Erro ao habilitar WhatsApp');
      }

      toast.success('WhatsApp habilitado! Iniciando serviço... 🎉');

      // Then restart the service to initialize and generate QR code
      setTimeout(async () => {
        try {
          await handleWhatsAppAction('restart');
          toast.success('Serviço iniciado! Aguarde o QR Code aparecer...');
        } catch (error) {
          console.error('Error restarting WhatsApp service:', error);
          toast.error('Erro ao iniciar serviço. Tente clicar em "Reiniciar Serviço"');
        }
      }, 1000);

      await loadData(); // Reload data

    } catch (error) {
      console.error('Error enabling WhatsApp:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao habilitar WhatsApp');
    }
  };

  /* Função de desabilitar escondida para usuários normais
  const handleDisableWhatsApp = async () => {
    try {
      console.log('🔍 Frontend: Desabilitando WhatsApp...');
      
      // First disable in settings
      const response = await whatsappService.updateSettings({
        enabled: false,
        rateLimitSeconds: 30
      });

      console.log('🔍 Frontend: Resposta updateSettings:', response);

      if (!response.success) {
        throw new Error(response.error || 'Erro ao desabilitar WhatsApp');
      }

      toast.success('WhatsApp desabilitado com sucesso! 🔴');

      // Reload data to reflect changes
      console.log('🔍 Frontend: Recarregando dados...');
      await loadData();
      console.log('🔍 Frontend: Dados recarregados');

    } catch (error) {
      console.error('Error disabling WhatsApp:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao desabilitar WhatsApp');
    }
  };
  */

  const handleSendTestMessage = async () => {
    if (!testMessage.phoneNumber || !testMessage.message) {
      toast.error('Número de telefone e mensagem são obrigatórios');
      return;
    }

    setIsSending(true);
    try {
      const response = await whatsappService.sendMessage(testMessage.phoneNumber, testMessage.message);

      if (!response.success) {
        throw new Error(response.error || 'Erro ao enviar mensagem');
      }

      toast.success('Mensagem de teste enviada com sucesso!');
      setTestMessage({ ...testMessage, phoneNumber: '', message: 'Olá! Esta é uma mensagem de teste do VoxStudent. 📱' });
      await loadData(); // Reload stats

    } catch (error) {
      console.error('Error sending test message:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar mensagem');
    } finally {
      setIsSending(false);
    }
  };

  const handleScheduleReminders = async () => {
    try {
      const response = await fetch('/api/reminders/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          hoursBeforeClass: 24,
          type: 'manual'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao agendar lembretes');
      }

      toast.success(data.message);
      await loadData(); // Reload stats
      
    } catch (error) {
      console.error('Error scheduling reminders:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao agendar lembretes');
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto animate-spin" size={48} />
          <p className="mt-4 text-muted-foreground">Carregando painel do WhatsApp...</p>
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
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <Button onClick={() => router.push('/')} variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <MessageSquare className="w-8 h-8 mr-3" />
              Painel do WhatsApp
            </h1>
          </div>
          <Button onClick={loadData} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="messages">Mensagens</TabsTrigger>
            <TabsTrigger value="queue">Fila</TabsTrigger>
            <TabsTrigger value="reminders">Lembretes</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Connection Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Status da Conexão
                </CardTitle>
                <CardDescription>
                  Status atual da conexão com o WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    <span>Carregando status do WhatsApp...</span>
                  </div>
                ) : whatsappStatus?.settings?.enabled ? (
                  <>
                    {/* Connection Status with Enhanced Visual */}
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div>
                            <span className="font-semibold text-lg">
                              {whatsappStatus.connection?.isReady ? '🟢 Conectado' :
                               whatsappStatus.connection?.isInitializing ? '🟡 Conectando...' :
                               whatsappStatus.settings?.enabled && !whatsappStatus.connection?.qrCode ? '⏳ Aguardando inicialização...' :
                               '🔴 Desconectado'}
                            </span>
                            <p className="text-sm text-gray-600">
                              {whatsappStatus.connection?.isReady ? 'WhatsApp está pronto para enviar mensagens' :
                               whatsappStatus.connection?.isInitializing ? 'Estabelecendo conexão com WhatsApp...' :
                               whatsappStatus.settings?.enabled && !whatsappStatus.connection?.qrCode ? 'Serviço habilitado, aguardando inicialização. Clique em "Reiniciar Serviço" se necessário.' :
                               'WhatsApp não está conectado. Clique em "Reiniciar Serviço" para conectar.'}
                            </p>
                          </div>
                        </div>
                        {whatsappStatus.connection?.phoneNumber && (
                          <Badge variant="outline" className="text-sm">
                            📱 {whatsappStatus.connection.phoneNumber}
                          </Badge>
                        )}
                      </div>

                      {/* Connection Details */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Status:</span>
                          {whatsappStatus.connection?.isAuthenticated ? (
                            <Badge className="ml-2 bg-green-100 text-green-800 border-green-200">
                              ✅ Autenticado
                            </Badge>
                          ) : (
                            <span className="ml-2 font-medium text-red-600">
                              ❌ Não autenticado
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-gray-600">Integração:</span>
                          <span className={`ml-2 font-medium ${
                            whatsappStatus.settings?.enabled ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {whatsappStatus.settings?.enabled ? 'Habilitada' : 'Desabilitada'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      {!whatsappStatus.settings?.enabled ? (
                        <Button
                          size="sm"
                          onClick={handleEnableWhatsApp}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Habilitar WhatsApp
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleWhatsAppAction('verify')}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Verificar Conexão
                          </Button>
                          {/* Botões especiais escondidos para usuários normais
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleWhatsAppAction('restart')}
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Reiniciar Serviço
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleDisableWhatsApp}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Pause className="w-4 h-4 mr-2" />
                            Desabilitar
                          </Button>
                          */}
                        </>
                      )}
                    </div>

                    {/* QR Code Section */}
                    {whatsappStatus.connection?.qrCode ? (
                      <div className="mt-6">
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                            <span className="font-semibold text-yellow-900">Aguardando conexão</span>
                          </div>
                          <p className="text-sm text-yellow-800">
                            Escaneie o QR Code abaixo com seu WhatsApp para conectar
                          </p>
                        </div>
                        <WhatsAppQRCode
                          qrCodeData={whatsappStatus.connection?.qrCode || ''}
                          className="mt-4"
                        />
                      </div>
                    ) : whatsappStatus.settings?.enabled && !whatsappStatus.connection?.isReady && !whatsappStatus.connection?.isInitializing ? (
                      <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="text-center">
                          <h4 className="font-semibold text-orange-900 mb-2">
                            ⚠️ WhatsApp habilitado mas não conectado
                          </h4>
                          <p className="text-sm text-orange-800 mb-4">
                            O serviço WhatsApp está habilitado mas não foi inicializado. Clique no botão abaixo para gerar o QR Code.
                          </p>
                          <Button
                            onClick={() => handleWhatsAppAction('restart')}
                            className="bg-orange-600 hover:bg-orange-700"
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Gerar QR Code
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                      <MessageSquare className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">
                      🚀 Configure o WhatsApp
                    </h3>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                      Conecte sua conta WhatsApp para enviar lembretes automáticos e permitir login via WhatsApp para estudantes
                    </p>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 max-w-md mx-auto">
                      <h4 className="font-semibold text-blue-900 mb-2">📋 Processo de Setup:</h4>
                      <ol className="text-sm text-blue-800 text-left space-y-1">
                        <li>1. Clique em "Iniciar Configuração"</li>
                        <li>2. Aguarde o QR Code aparecer</li>
                        <li>3. Abra WhatsApp no celular</li>
                        <li>4. Vá em Menu → Dispositivos conectados</li>
                        <li>5. Escaneie o QR Code</li>
                      </ol>
                    </div>

                    <Button
                      onClick={handleEnableWhatsApp}
                      className="bg-green-600 hover:bg-green-700 text-lg px-8 py-3"
                      size="lg"
                    >
                      <Play className="w-5 h-5 mr-2" />
                      Iniciar Configuração
                    </Button>

                    <p className="text-xs text-gray-500 mt-4">
                      💡 Certifique-se de ter WhatsApp instalado no seu celular
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Statistics */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Mensagens</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {whatsappStatus?.statistics?.totalMessages || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Mensagens Enviadas</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {whatsappStatus?.statistics?.sentMessages || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Mensagens Falharam</CardTitle>
                  <XCircle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {whatsappStatus?.statistics?.failedMessages || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {whatsappStatus?.statistics?.successRate || '0'}%
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="messages" className="space-y-6">
            {/* Test Message */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Send className="w-5 h-5 mr-2" />
                  Enviar Mensagem de Teste
                </CardTitle>
                <CardDescription>
                  Teste a conexão enviando uma mensagem
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="testPhone">Número do WhatsApp</Label>
                    <Input
                      id="testPhone"
                      type="tel"
                      value={testMessage.phoneNumber}
                      onChange={(e) => setTestMessage({ ...testMessage, phoneNumber: e.target.value })}
                      placeholder="+55 11 99999-9999"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="testMessage">Mensagem</Label>
                  <Textarea
                    id="testMessage"
                    value={testMessage.message}
                    onChange={(e) => setTestMessage({ ...testMessage, message: e.target.value })}
                    placeholder="Digite sua mensagem de teste..."
                    rows={3}
                  />
                </div>
                <Button
                  onClick={handleSendTestMessage}
                  disabled={isSending || !testMessage.phoneNumber || !testMessage.message}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Enviar Teste
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="queue" className="space-y-6">
            {/* Queue Statistics */}
            <div className="grid gap-6 md:grid-cols-5">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
                  <Clock className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">
                    {queueStats?.pendingMessages || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Processando</CardTitle>
                  <Loader2 className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {queueStats?.processingMessages || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Enviadas</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {queueStats?.sentMessages || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Falharam</CardTitle>
                  <XCircle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {queueStats?.failedMessages || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {queueStats?.totalMessages || 0}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="reminders" className="space-y-6">
            {/* Reminder Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Gerenciar Lembretes
                </CardTitle>
                <CardDescription>
                  Agendar e gerenciar lembretes automáticos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex space-x-2">
                  <Button onClick={handleScheduleReminders}>
                    <Play className="w-4 h-4 mr-2" />
                    Agendar Lembretes (24h)
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push('/admin/reminder-templates')}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Gerenciar Templates
                  </Button>
                </div>
                <p className="text-sm text-gray-600">
                  Os lembretes são enviados automaticamente 24 horas antes das aulas agendadas.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
