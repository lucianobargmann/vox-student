'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Settings, ArrowLeft, Save, Mail, MessageSquare, Shield, Database, Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { whatsappService, WhatsAppStatus } from '@/lib/services/whatsapp.service';
import { WhatsAppQRCode } from '@/components/WhatsAppQRCode';

export default function SystemSettings() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus | null>(null);
  const [settings, setSettings] = useState({
    // General Settings
    systemName: 'VoxStudent',
    systemDescription: 'Sistema de Gestão Educacional',

    // Email Settings
    emailEnabled: true,
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPassword: '',

    // WhatsApp Settings
    whatsappEnabled: false,
    whatsappApiKey: '',
    whatsappPhoneNumber: '',
    whatsappRateLimitSeconds: 30,

    // Security Settings
    sessionTimeout: '24',
    maxLoginAttempts: '5',
    passwordMinLength: '8',

    // Notification Settings
    emailNotifications: true,
    whatsappNotifications: false,
    reminderHours: '24'
  });

  // Load WhatsApp settings on component mount
  useEffect(() => {
    const loadWhatsAppSettings = async () => {
      try {
        const [settingsResponse, statusResponse] = await Promise.all([
          whatsappService.getSettings(),
          whatsappService.getStatus()
        ]);

        if (settingsResponse.success && settingsResponse.data) {
          setSettings(prev => ({
            ...prev,
            whatsappEnabled: settingsResponse.data!.enabled,
            whatsappPhoneNumber: settingsResponse.data!.phoneNumber || '',
            whatsappRateLimitSeconds: settingsResponse.data!.rateLimitSeconds || 30,
            whatsappNotifications: settingsResponse.data!.enabled
          }));
        }

        if (statusResponse.success && statusResponse.data) {
          setWhatsappStatus(statusResponse.data);
        }
      } catch (error) {
        console.error('Error loading WhatsApp settings:', error);
        toast.error('Erro ao carregar configurações do WhatsApp');
      } finally {
        setIsLoading(false);
      }
    };

    if (user && ['admin', 'super_admin'].includes(user.profile?.role || '')) {
      loadWhatsAppSettings();
    }
  }, [user]);

  // Redirect if not admin
  useEffect(() => {
    if (!loading && (!user || !['admin', 'super_admin'].includes(user.profile?.role || ''))) {
      router.push('/');
      return;
    }
  }, [user, loading]);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // Save WhatsApp settings
      const response = await whatsappService.updateSettings({
        enabled: settings.whatsappEnabled,
        rateLimitSeconds: settings.whatsappRateLimitSeconds
      });

      if (!response.success) {
        throw new Error(response.error || 'Erro ao salvar configurações do WhatsApp');
      }

      toast.success('Configurações salvas com sucesso!');

      // Reload WhatsApp status after saving
      const statusResponse = await whatsappService.getStatus();
      if (statusResponse.success && statusResponse.data) {
        setWhatsappStatus(statusResponse.data);
      }

    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  const handleWhatsAppAction = async (action: 'verify' | 'restart') => {
    try {
      const response = await whatsappService.performAction(action);

      if (!response.success) {
        throw new Error(response.error || `Erro ao ${action === 'verify' ? 'verificar' : 'reiniciar'} WhatsApp`);
      }

      if (response.data?.message) {
        toast.success(response.data.message);
      }

      // Reload status
      const statusResponse = await whatsappService.getStatus();
      if (statusResponse.success && statusResponse.data) {
        setWhatsappStatus(statusResponse.data);
      }

    } catch (error) {
      console.error(`Error ${action} WhatsApp:`, error);
      toast.error(error instanceof Error ? error.message : `Erro ao ${action === 'verify' ? 'verificar' : 'reiniciar'} WhatsApp`);
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

  if (!user || !['admin', 'super_admin'].includes(user.profile?.role || '')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <Button onClick={() => router.push('/')} variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Settings className="w-8 h-8 mr-3" />
              Configurações do Sistema
            </h1>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar Configurações
              </>
            )}
          </Button>
        </div>

        <div className="space-y-6">
          {/* General Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="w-5 h-5 mr-2" />
                Configurações Gerais
              </CardTitle>
              <CardDescription>
                Configurações básicas do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="systemName">Nome do Sistema</Label>
                  <Input
                    id="systemName"
                    value={settings.systemName}
                    onChange={(e) => setSettings({ ...settings, systemName: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="systemDescription">Descrição do Sistema</Label>
                <Textarea
                  id="systemDescription"
                  value={settings.systemDescription}
                  onChange={(e) => setSettings({ ...settings, systemDescription: e.target.value })}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Email Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="w-5 h-5 mr-2" />
                Configurações de Email
              </CardTitle>
              <CardDescription>
                Configure o servidor SMTP para envio de emails
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="emailEnabled"
                  checked={settings.emailEnabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, emailEnabled: checked })}
                />
                <Label htmlFor="emailEnabled">Habilitar envio de emails</Label>
              </div>

              {settings.emailEnabled && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="smtpHost">Servidor SMTP</Label>
                    <Input
                      id="smtpHost"
                      value={settings.smtpHost}
                      onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtpPort">Porta SMTP</Label>
                    <Input
                      id="smtpPort"
                      value={settings.smtpPort}
                      onChange={(e) => setSettings({ ...settings, smtpPort: e.target.value })}
                      placeholder="587"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtpUser">Usuário SMTP</Label>
                    <Input
                      id="smtpUser"
                      value={settings.smtpUser}
                      onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                      placeholder="seu-email@gmail.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtpPassword">Senha SMTP</Label>
                    <Input
                      id="smtpPassword"
                      type="password"
                      value={settings.smtpPassword}
                      onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })}
                      placeholder="sua-senha"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* WhatsApp Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageSquare className="w-5 h-5 mr-2" />
                Configurações do WhatsApp
              </CardTitle>
              <CardDescription>
                Configure a integração com WhatsApp para envio de lembretes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Setup Initial */}
              {!whatsappStatus && (
                <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start space-x-4">
                    <div className="p-2 bg-blue-100 rounded-full">
                      <MessageSquare className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-blue-900 mb-2">
                        🚀 Configure o WhatsApp
                      </h3>
                      <p className="text-blue-800 mb-4">
                        Habilite a integração WhatsApp para enviar lembretes e permitir login via WhatsApp para estudantes e administradores.
                      </p>
                      <div className="space-y-2 text-sm text-blue-700">
                        <p>✅ Envio de lembretes de aulas</p>
                        <p>✅ Login via WhatsApp para estudantes</p>
                        <p>✅ Notificações automáticas</p>
                        <p>✅ Controle de rate limiting</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Switch
                    id="whatsappEnabled"
                    checked={settings.whatsappEnabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, whatsappEnabled: checked })}
                  />
                  <div>
                    <Label htmlFor="whatsappEnabled" className="text-base font-medium">
                      Habilitar integração WhatsApp
                    </Label>
                    <p className="text-sm text-gray-600">
                      Permite envio de mensagens e login via WhatsApp
                    </p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  settings.whatsappEnabled
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {settings.whatsappEnabled ? 'Habilitado' : 'Desabilitado'}
                </div>
              </div>

              {/* WhatsApp Status */}
              {whatsappStatus && settings.whatsappEnabled && (
                <div className="p-4 bg-white border border-gray-200 rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">Status da Conexão</h4>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push('/admin/whatsapp')}
                    >
                      Ver Painel Completo
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded-full ${
                        whatsappStatus.connection?.isReady ? 'bg-green-500 animate-pulse' :
                        whatsappStatus.connection?.isInitializing ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                      }`} />
                      <div>
                        <span className="font-medium">
                          {whatsappStatus.connection?.isReady ? '🟢 Conectado' :
                           whatsappStatus.connection?.isInitializing ? '🟡 Conectando...' : '🔴 Desconectado'}
                        </span>
                        <p className="text-xs text-gray-600">
                          {whatsappStatus.connection?.isAuthenticated ? 'Autenticado' : 'Não autenticado'}
                        </p>
                      </div>
                    </div>
                    {whatsappStatus.connection?.phoneNumber && (
                      <div className="text-sm">
                        <span className="text-gray-600">Número conectado:</span>
                        <p className="font-medium">📱 {whatsappStatus.connection.phoneNumber}</p>
                      </div>
                    )}
                  </div>

                  {/* Statistics */}
                  {whatsappStatus.statistics && (
                    <div className="grid gap-2 md:grid-cols-4 text-sm">
                      <div>
                        <span className="text-gray-600">Total: </span>
                        <span className="font-medium">{whatsappStatus.statistics.totalMessages}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Enviadas: </span>
                        <span className="font-medium text-green-600">{whatsappStatus.statistics.sentMessages}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Falharam: </span>
                        <span className="font-medium text-red-600">{whatsappStatus.statistics.failedMessages}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Taxa de sucesso: </span>
                        <span className="font-medium">{whatsappStatus.statistics.successRate}%</span>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleWhatsAppAction('verify')}
                    >
                      Verificar Conexão
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleWhatsAppAction('restart')}
                    >
                      Reiniciar Serviço
                    </Button>
                  </div>

                  {/* QR Code Display */}
                  {whatsappStatus.connection?.qrCode && (
                    <WhatsAppQRCode
                      qrCodeData={whatsappStatus.connection.qrCode}
                      className="mt-4"
                    />
                  )}
                </div>
              )}

              {settings.whatsappEnabled ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="whatsappRateLimitSeconds">Rate Limit (segundos entre mensagens)</Label>
                    <Input
                      id="whatsappRateLimitSeconds"
                      type="number"
                      value={settings.whatsappRateLimitSeconds}
                      onChange={(e) => setSettings({ ...settings, whatsappRateLimitSeconds: parseInt(e.target.value) || 30 })}
                      min="10"
                      max="300"
                      className="w-32"
                    />
                    <p className="text-xs text-gray-500">Tempo mínimo entre envio de mensagens (10-300 segundos)</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className="p-1 bg-yellow-100 rounded-full">
                      <MessageSquare className="w-4 h-4 text-yellow-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-yellow-900 mb-1">
                        WhatsApp Desabilitado
                      </h4>
                      <p className="text-sm text-yellow-800 mb-3">
                        Habilite a integração WhatsApp para:
                      </p>
                      <ul className="text-sm text-yellow-700 space-y-1">
                        <li>• Enviar lembretes de aulas automaticamente</li>
                        <li>• Permitir login via WhatsApp para estudantes</li>
                        <li>• Receber notificações importantes</li>
                      </ul>
                      <p className="text-xs text-yellow-600 mt-3">
                        💡 Após habilitar, clique em "Salvar" e vá para o <strong>Painel do WhatsApp</strong> para conectar sua conta.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="w-5 h-5 mr-2" />
                Configurações de Segurança
              </CardTitle>
              <CardDescription>
                Configure parâmetros de segurança do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">Timeout da Sessão (horas)</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    value={settings.sessionTimeout}
                    onChange={(e) => setSettings({ ...settings, sessionTimeout: e.target.value })}
                    min="1"
                    max="168"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxLoginAttempts">Máx. Tentativas de Login</Label>
                  <Input
                    id="maxLoginAttempts"
                    type="number"
                    value={settings.maxLoginAttempts}
                    onChange={(e) => setSettings({ ...settings, maxLoginAttempts: e.target.value })}
                    min="3"
                    max="10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passwordMinLength">Tamanho Mín. da Senha</Label>
                  <Input
                    id="passwordMinLength"
                    type="number"
                    value={settings.passwordMinLength}
                    onChange={(e) => setSettings({ ...settings, passwordMinLength: e.target.value })}
                    min="6"
                    max="20"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="w-5 h-5 mr-2" />
                Configurações de Notificações
              </CardTitle>
              <CardDescription>
                Configure como e quando enviar notificações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="emailNotifications"
                    checked={settings.emailNotifications}
                    onCheckedChange={(checked) => setSettings({ ...settings, emailNotifications: checked })}
                  />
                  <Label htmlFor="emailNotifications">Notificações por email</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="whatsappNotifications"
                    checked={settings.whatsappNotifications}
                    onCheckedChange={(checked) => setSettings({ ...settings, whatsappNotifications: checked })}
                  />
                  <Label htmlFor="whatsappNotifications">Notificações por WhatsApp</Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reminderHours">Enviar lembretes (horas antes)</Label>
                  <Input
                    id="reminderHours"
                    type="number"
                    value={settings.reminderHours}
                    onChange={(e) => setSettings({ ...settings, reminderHours: e.target.value })}
                    min="1"
                    max="168"
                    className="w-32"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="w-5 h-5 mr-2" />
                Informações do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 text-sm">
                <div>
                  <p className="font-medium">Versão do Sistema</p>
                  <p className="text-muted-foreground">VoxStudent v1.0.0</p>
                </div>
                <div>
                  <p className="font-medium">Banco de Dados</p>
                  <p className="text-muted-foreground">PostgreSQL</p>
                </div>
                <div>
                  <p className="font-medium">Última Atualização</p>
                  <p className="text-muted-foreground">{new Date().toLocaleDateString('pt-BR')}</p>
                </div>
                <div>
                  <p className="font-medium">Status</p>
                  <p className="text-green-600">✓ Sistema Operacional</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
