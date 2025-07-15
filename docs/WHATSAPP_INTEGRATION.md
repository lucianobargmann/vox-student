# 📱 Integração WhatsApp - VoxStudent

Este documento explica como funciona a integração com WhatsApp no sistema VoxStudent, incluindo configuração, autenticação, envio de mensagens e funcionalidades de login via magic link.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Configuração Inicial](#configuração-inicial)
- [Autenticação WhatsApp](#autenticação-whatsapp)
- [Funcionalidades](#funcionalidades)
- [API Endpoints](#api-endpoints)
- [Banco de Dados](#banco-de-dados)
- [Sistema de Filas](#sistema-de-filas)
- [Rate Limiting](#rate-limiting)
- [Magic Link via WhatsApp](#magic-link-via-whatsapp)
- [Logs e Monitoramento](#logs-e-monitoramento)
- [Troubleshooting](#troubleshooting)

## 🎯 Visão Geral

A integração WhatsApp do VoxStudent utiliza a biblioteca `whatsapp-web.js` para conectar-se ao WhatsApp Web e enviar mensagens automatizadas. O sistema inclui:

- **Autenticação via QR Code**: Conecta uma conta WhatsApp ao sistema
- **Envio de Mensagens**: Lembretes de aulas, confirmações e notificações
- **Sistema de Filas**: Processamento assíncrono de mensagens
- **Rate Limiting**: Controle de frequência de envio (padrão: 30 segundos)
- **Magic Link Login**: Login via WhatsApp para administradores
- **Logs Detalhados**: Monitoramento completo de atividades

## ⚙️ Configuração Inicial

### 1. Variáveis de Ambiente

Adicione as seguintes variáveis ao seu arquivo `.env`:

```env
# Configuração de Telefones Autorizados para Magic Link
SUPER_ADMIN_PHONE="+5511999999999"  # Telefone do super administrador
ADMIN_PHONES="+5511888888888,+5511777777777"  # Telefones de administradores (separados por vírgula)

# Configuração da Aplicação (já existentes)
NEXTAUTH_URL="http://localhost:3000"
JWT_SECRET="your-super-secret-jwt-key"
MAGIC_LINK_EXPIRY_MINUTES="15"

# Nota: Estudantes não precisam ser configurados aqui
# Eles são automaticamente autorizados se tiverem telefone cadastrado no sistema
```

### 2. Dependências

As dependências necessárias já estão incluídas no projeto:

```json
{
  "whatsapp-web.js": "^1.23.0",
  "qrcode-terminal": "^0.12.0"
}
```

### 3. Estrutura de Arquivos

```
src/
├── lib/
│   ├── whatsapp.ts              # Classe principal WhatsApp
│   ├── message-queue.ts         # Sistema de filas
│   ├── whatsapp-logger.ts       # Sistema de logs
│   └── auth.ts                  # Funções de autorização
├── app/api/whatsapp/
│   ├── status/route.ts          # Status e controle da conexão
│   ├── settings/route.ts        # Configurações
│   ├── send/route.ts           # Envio de mensagens
│   └── magic-link/route.ts     # Login via WhatsApp
└── app/admin/
    ├── whatsapp/page.tsx       # Interface de administração
    └── settings/page.tsx       # Configurações gerais
```

## 🔐 Autenticação WhatsApp

### 1. Processo de Conexão

1. **Habilitação**: Ative a integração na página de configurações
2. **QR Code**: O sistema gera um QR Code para autenticação
3. **Escaneamento**: Use o WhatsApp do celular para escanear o código
4. **Conexão**: O sistema estabelece a conexão e salva a sessão

### 2. Interface de Administração

Acesse `/admin/whatsapp` para:

- ✅ Habilitar/desabilitar a integração
- 📱 Visualizar status da conexão
- 🔄 Verificar ou reiniciar a conexão
- 📊 Ver estatísticas de mensagens
- ⚙️ Configurar rate limiting

### 3. Estados da Conexão

- **🔴 Desconectado**: WhatsApp não conectado
- **🟡 Conectando**: Estabelecendo conexão
- **🟢 Conectado**: Pronto para enviar mensagens
- **❌ Erro**: Problema na conexão

## 🚀 Funcionalidades

### 1. Envio de Mensagens

```typescript
// Envio direto via API
const response = await fetch('/api/whatsapp/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phoneNumber: '+5511999999999',
    message: 'Sua aula está confirmada para hoje às 19h!',
    messageType: 'aula'
  })
});
```

### 2. Templates de Mensagem

O sistema suporta diferentes tipos de mensagem:

- **`aula`**: Lembretes de aulas regulares
- **`mentoria`**: Confirmações de mentorias
- **`reposicao`**: Notificações de aulas de reposição
- **`general`**: Mensagens gerais

### 3. Sistema de Placeholders

```typescript
// Exemplo de template com placeholders
const template = `Olá {{studentName}}! 
Sua aula de {{courseName}} está confirmada para {{date}} às {{time}}.
Local: {{location}}`;

// Substituição automática
const message = template
  .replace('{{studentName}}', 'João')
  .replace('{{courseName}}', 'Inglês')
  .replace('{{date}}', '15/07/2025')
  .replace('{{time}}', '19:00')
  .replace('{{location}}', 'Sala 101');
```

## 🔌 API Endpoints

### 1. Status e Controle

```http
GET /api/whatsapp/status
```
Retorna status da conexão e estatísticas.

```http
POST /api/whatsapp/status
Content-Type: application/json

{
  "action": "verify" | "restart"
}
```
Verifica ou reinicia a conexão.

### 2. Configurações

```http
GET /api/whatsapp/settings
```
Obtém configurações atuais.

```http
PUT /api/whatsapp/settings
Content-Type: application/json

{
  "enabled": true,
  "rateLimitSeconds": 30
}
```
Atualiza configurações.

### 3. Envio de Mensagens

```http
POST /api/whatsapp/send
Content-Type: application/json

{
  "phoneNumber": "+5511999999999",
  "message": "Texto da mensagem",
  "messageType": "aula"
}
```

### 4. Magic Link

```http
POST /api/whatsapp/magic-link
Content-Type: application/json

{
  "phoneNumber": "+5511999999999"
}
```
Envia link de login via WhatsApp.

## 🗄️ Banco de Dados

### 1. Tabelas Principais

#### WhatsAppSettings
```sql
CREATE TABLE whatsapp_settings (
  id TEXT PRIMARY KEY,
  enabled BOOLEAN DEFAULT FALSE,
  session_data TEXT,           -- Dados da sessão criptografados
  qr_code TEXT,               -- QR Code atual
  is_authenticated BOOLEAN DEFAULT FALSE,
  phone_number TEXT,          -- Número conectado
  last_connection_check DATETIME,
  rate_limit_seconds INTEGER DEFAULT 30,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### WhatsAppMessage
```sql
CREATE TABLE whatsapp_messages (
  id TEXT PRIMARY KEY,
  recipient_phone TEXT NOT NULL,
  message_text TEXT NOT NULL,
  message_id TEXT,            -- ID do WhatsApp
  message_type TEXT,          -- aula, mentoria, reposicao
  sent_at DATETIME,
  delivery_status TEXT DEFAULT 'pending', -- pending, sent, delivered, failed
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### MessageQueue
```sql
CREATE TABLE message_queue (
  id TEXT PRIMARY KEY,
  recipient_phone TEXT NOT NULL,
  message_text TEXT NOT NULL,
  message_type TEXT,
  priority INTEGER DEFAULT 3,  -- 1=alta, 5=baixa
  scheduled_for DATETIME NOT NULL,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  status TEXT DEFAULT 'pending', -- pending, processing, sent, failed, cancelled
  sent_at DATETIME,
  last_attempt_at DATETIME,
  error_message TEXT,
  metadata TEXT,              -- JSON com dados extras
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### WhatsAppLog
```sql
CREATE TABLE whatsapp_logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL,        -- debug, info, warn, error, critical
  event_type TEXT NOT NULL,   -- connection_established, message_sent, etc.
  message TEXT NOT NULL,
  metadata TEXT,              -- JSON com dados extras
  error_message TEXT,
  error_stack TEXT,
  user_id TEXT,
  phone_number TEXT,
  message_id TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 📬 Sistema de Filas

### 1. Funcionamento

O sistema de filas processa mensagens de forma assíncrona:

1. **Enfileiramento**: Mensagens são adicionadas à fila
2. **Processamento**: Worker processa mensagens pendentes
3. **Rate Limiting**: Respeita intervalo entre envios
4. **Retry**: Tenta reenviar mensagens falhadas
5. **Logging**: Registra todas as atividades

### 2. Configuração da Fila

```typescript
// Adicionar mensagem à fila
await messageQueue.enqueue({
  recipientPhone: '+5511999999999',
  messageText: 'Sua aula está confirmada!',
  messageType: 'aula',
  priority: 1,                    // Alta prioridade
  scheduledFor: new Date(),       // Enviar agora
  maxAttempts: 3,                 // Máximo 3 tentativas
  metadata: {
    studentId: 'student123',
    lessonId: 'lesson456'
  }
});
```

### 3. Worker de Processamento

O worker roda automaticamente e:

- ✅ Verifica se WhatsApp está conectado
- ⏰ Respeita rate limiting
- 🔄 Processa mensagens por prioridade
- 📝 Atualiza status das mensagens
- 🚨 Registra erros e falhas

## ⏱️ Rate Limiting

### 1. Configuração

- **Padrão**: 30 segundos entre mensagens
- **Configurável**: Via interface de administração
- **Por Destinatário**: Controle individual por número

### 2. Funcionamento

```typescript
// Verificação de rate limit
const rateLimitInfo = checkRateLimit(phoneNumber);
if (!rateLimitInfo.canSend) {
  const waitTime = Math.ceil(rateLimitInfo.remainingTime / 1000);
  throw new Error(`Rate limit atingido. Aguarde ${waitTime} segundos.`);
}

// Atualização após envio
updateRateLimit(phoneNumber);
```

### 3. Bypass para Emergências

Mensagens com prioridade 1 podem ter rate limiting reduzido para situações urgentes.

## 🔑 Magic Link via WhatsApp

### 1. Configuração de Telefones Autorizados

```env
# Super administrador
SUPER_ADMIN_PHONE="+5511999999999"

# Administradores (separados por vírgula)
ADMIN_PHONES="+5511888888888,+5511777777777,+5511666666666"
```

### 2. Processo de Login

1. **Solicitação**: Usuário informa número de telefone
2. **Validação**: Sistema verifica se número está autorizado
3. **Criação de Usuário**: Se não existir, cria perfil automaticamente
4. **Geração de Token**: Cria token de acesso temporário
5. **Envio**: Envia link via WhatsApp
6. **Login**: Usuário clica no link e é autenticado

### 3. Formato da Mensagem

```
🔐 VoxStudent - Link de Acesso

Olá! Você solicitou acesso ao VoxStudent.

Clique no link abaixo para fazer login:
https://app.voxstudent.com/auth/verify?token=abc123

⏰ Este link expira em 15 minutos.

Se você não solicitou este acesso, pode ignorar esta mensagem com segurança.

© 2025 VoxStudent - Sistema de Gestão Educacional
```

### 4. Segurança

- ✅ Administradores e estudantes cadastrados podem solicitar login
- ⏰ Tokens expiram em 15 minutos (configurável)
- 🔒 Tokens são únicos e de uso único
- 📱 Validação de formato de telefone
- 🚫 Rate limiting para tentativas de login

### 5. Autorização de Usuários

O sistema permite login via WhatsApp para:

#### 👨‍💼 **Administradores**
- Números configurados em `SUPER_ADMIN_PHONE` (super administrador)
- Números configurados em `ADMIN_PHONES` (administradores)
- Recebem role `super_admin` ou `admin` automaticamente

#### 🎓 **Estudantes**
- Estudantes com telefone cadastrado no sistema
- Status deve ser `active` no banco de dados
- Recebem role `student` automaticamente
- Nome é obtido do cadastro do estudante

#### ❌ **Não Autorizados**
- Números não cadastrados como admin ou estudante
- Estudantes com status `inactive`
- Números com formato inválido

## 📊 Logs e Monitoramento

### 1. Tipos de Log

- **`debug`**: Informações detalhadas de desenvolvimento
- **`info`**: Eventos normais do sistema
- **`warn`**: Situações que requerem atenção
- **`error`**: Erros que não impedem funcionamento
- **`critical`**: Erros graves que afetam o sistema

### 2. Eventos Monitorados

- **`connection_established`**: Conexão WhatsApp estabelecida
- **`connection_lost`**: Perda de conexão
- **`message_sent`**: Mensagem enviada com sucesso
- **`message_failed`**: Falha no envio
- **`rate_limit_hit`**: Rate limit atingido
- **`qr_code_generated`**: QR Code gerado
- **`authentication_success`**: Autenticação bem-sucedida

### 3. Consulta de Logs

```typescript
// Buscar logs por tipo de evento
const logs = await prisma.whatsAppLog.findMany({
  where: {
    eventType: 'message_sent',
    timestamp: {
      gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24h
    }
  },
  orderBy: { timestamp: 'desc' }
});
```

## 🔧 Troubleshooting

### 1. Problemas Comuns

#### WhatsApp não conecta
```bash
# Verificar logs
tail -f logs/whatsapp.log

# Limpar sessão
rm -rf whatsapp-session/
```

#### Mensagens não são enviadas
1. ✅ Verificar se WhatsApp está conectado
2. ✅ Confirmar rate limiting
3. ✅ Validar formato do telefone
4. ✅ Verificar logs de erro

#### QR Code não aparece
1. ✅ Verificar se integração está habilitada
2. ✅ Reiniciar serviço WhatsApp
3. ✅ Limpar cache do navegador
4. ✅ Verificar se o QR Code está sendo salvo no banco:
   ```sql
   SELECT qr_code FROM whatsapp_settings WHERE id = 'default';
   ```
5. ✅ Verificar logs do WhatsApp para erros de geração

### 2. Comandos Úteis

```bash
# Verificar status da conexão
curl -X GET http://localhost:3000/api/whatsapp/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Enviar mensagem de teste
curl -X POST http://localhost:3000/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "phoneNumber": "+5511999999999",
    "message": "Teste de conexão WhatsApp"
  }'

# Verificar fila de mensagens
curl -X GET http://localhost:3000/api/queue \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Logs de Debug

Para ativar logs detalhados, defina a variável de ambiente:

```env
DEBUG_WHATSAPP=true
```

### 4. Monitoramento de Performance

```typescript
// Estatísticas de performance
const stats = await prisma.whatsAppMessage.groupBy({
  by: ['deliveryStatus'],
  _count: true,
  where: {
    createdAt: {
      gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
    }
  }
});

console.log('Estatísticas 24h:', stats);
// Resultado: [
//   { deliveryStatus: 'sent', _count: 45 },
//   { deliveryStatus: 'failed', _count: 2 },
//   { deliveryStatus: 'pending', _count: 1 }
// ]
```

## 📝 Notas Importantes

1. **Sessão WhatsApp**: A sessão é salva localmente em `whatsapp-session/`
2. **Backup**: Faça backup da pasta de sessão para evitar reconexões
3. **Produção**: Use PM2 ou similar para manter o processo ativo
4. **Segurança**: Nunca exponha tokens ou dados de sessão
5. **Rate Limiting**: Respeite os limites para evitar bloqueios
6. **Monitoramento**: Monitore logs regularmente para detectar problemas

## 🔗 Links Úteis

- [whatsapp-web.js Documentation](https://wwebjs.dev/)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- [Puppeteer Documentation](https://pptr.dev/)

---

**Desenvolvido para VoxStudent** 📚✨
