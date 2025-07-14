# E2E Testing para VoxStudent

Este documento descreve os testes End-to-End (E2E) implementados para o sistema de autenticação por magic links do VoxStudent.

## Visão Geral

Os testes E2E utilizam Puppeteer para simular interações reais do usuário e verificar o funcionamento completo do sistema de autenticação, incluindo:

- Login com magic links
- Integração com Mailpit para testes de email
- Cenários de sucesso e erro
- Validação visual com screenshots
- Verificação de segurança (não envio de emails para usuários inexistentes)

## Sistema de Usuários e Admins

### Criação de Usuários
- **Usuários regulares**: Criados apenas quando adicionados a um curso
- **Super Admin**: Definido via `SUPER_ADMIN_EMAIL` no .env, criado automaticamente no primeiro login
- **Admins**: Definidos via `ADMIN_EMAILS` no .env, devem ser adicionados a cursos para existir no sistema

### Segurança
- Magic links são enviados APENAS para usuários que existem no sistema
- Exceção: Super admin pode fazer login mesmo se não estiver no banco (criado automaticamente)
- Mensagens de sucesso são sempre exibidas para prevenir enumeração de emails

## Estrutura dos Testes

### 📁 Arquivos de Teste

```
.augment/e2e-tests/
├── auth.test.js                    # Testes principais de autenticação
├── magic-link-edge-cases.test.js   # Testes de casos extremos
├── run-all-tests.js               # Executor principal
└── screenshots/                   # Screenshots dos testes
```

### 🚀 Scripts de Execução

```
scripts/
└── run-e2e-tests.sh              # Script completo de setup e execução
```

## Casos de Teste Implementados

### 🔐 Testes de Autenticação Principais

#### 1. **Super Admin Login Success**
- **Objetivo**: Verificar se `luciano@hcktplanet.com` pode fazer login com sucesso
- **Passos**:
  1. Navegar para página de login
  2. Inserir email do super admin
  3. Submeter formulário
  4. Verificar email no Mailpit
  5. Extrair magic link do email
  6. Navegar para magic link
  7. Verificar redirecionamento para dashboard
- **Resultado Esperado**: Login bem-sucedido e acesso ao dashboard

#### 2. **Non-existent User Email (Security)**
- **Objetivo**: Verificar que emails não são enviados para usuários inexistentes
- **Passos**:
  1. Usar email que não existe no sistema
  2. Verificar que mensagem de sucesso é exibida (anti-enumeração)
  3. Verificar que NENHUM email é enviado
- **Resultado Esperado**: Mensagem de sucesso exibida, mas nenhum email enviado

#### 3. **Invalid Email Format**
- **Objetivo**: Verificar validação de formato de email
- **Passos**:
  1. Tentar submeter email com formato inválido
  2. Verificar que validação impede submissão
- **Resultado Esperado**: Validação impede submissão de email inválido

#### 4. **Backend Not Responding**
- **Objetivo**: Verificar tratamento quando backend não responde
- **Passos**:
  1. Simular falha na API (interceptar requests)
  2. Verificar que erro é exibido ao usuário
- **Resultado Esperado**: Mensagem de erro adequada é exibida

### 🔗 Testes de Casos Extremos (Magic Links)

#### 5. **Used Magic Link**
- **Objetivo**: Verificar que magic links já utilizados são rejeitados
- **Passos**:
  1. Usar magic link uma vez (deve funcionar)
  2. Tentar usar o mesmo link novamente (deve falhar)
- **Resultado Esperado**: Segundo uso é rejeitado

#### 6. **Expired Magic Link**
- **Objetivo**: Verificar que magic links expirados são rejeitados
- **Passos**:
  1. Tentar usar token inválido/expirado
  2. Verificar que acesso é negado
- **Resultado Esperado**: Acesso negado para tokens inválidos

#### 7. **Multiple Magic Links**
- **Objetivo**: Verificar que apenas o último magic link é válido
- **Passos**:
  1. Solicitar primeiro magic link
  2. Solicitar segundo magic link
  3. Verificar que primeiro link é invalidado
  4. Verificar que segundo link funciona
- **Resultado Esperado**: Apenas o último link é válido

#### 8. **Malformed Magic Link**
- **Objetivo**: Verificar tratamento de URLs malformadas
- **Passos**:
  1. Testar URLs com tokens vazios, inválidos, ou maliciosos
  2. Verificar que todos são tratados adequadamente
- **Resultado Esperado**: URLs malformadas são tratadas com segurança

## Como Executar os Testes

### 🔧 Pré-requisitos

1. **Docker** - Para executar Mailpit
2. **Node.js** - Para executar Next.js e Puppeteer
3. **Dependências instaladas** - `npm install`

### 🚀 Execução Completa (Recomendado)

```bash
# Executa setup completo e todos os testes
./scripts/run-e2e-tests.sh
```

Este script:
- Verifica e inicia Docker se necessário
- Configura e inicia Mailpit
- Inicia servidor Next.js se necessário
- Limpa inbox do Mailpit
- Executa todos os testes
- Gera screenshots
- Faz cleanup automático

### 🧪 Execução Manual

```bash
# 1. Iniciar Mailpit
./scripts/setup-mailpit.sh

# 2. Iniciar Next.js (em terminal separado)
npm run dev

# 3. Executar testes específicos
node .augment/e2e-tests/auth.test.js
node .augment/e2e-tests/magic-link-edge-cases.test.js

# 4. Ou executar todos os testes
node .augment/e2e-tests/run-all-tests.js
```

## Configuração dos Testes

### 📋 Configurações Principais

```javascript
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',      // URL da aplicação
  mailpitUrl: 'http://localhost:8025',   // URL do Mailpit
  superAdminEmail: 'luciano@hcktplanet.com', // Email do super admin
  testTimeout: 30000,                    // Timeout dos testes
  headless: false,                       // Mostrar browser (true para CI)
};
```

### 🖼️ Screenshots

Os testes geram screenshots automaticamente em:
- **Localização**: `.augment/e2e-tests/screenshots/`
- **Formato**: `{nome-do-teste}-{timestamp}.png`
- **Uso**: Debugging visual e documentação

### 📧 Integração com Mailpit

- **Web UI**: http://localhost:8025
- **API**: Utilizada para verificar emails recebidos
- **Limpeza**: Inbox é limpo antes de cada teste

## Interpretação dos Resultados

### ✅ Teste Bem-sucedido

```
✅ PASSED - Super admin can login successfully
```

### ❌ Teste Falhado

```
❌ FAILED - Magic link email not received in Mailpit
```

### 📊 Resumo Final

```
📊 OVERALL RESULTS:
   Total Tests: 8
   Passed: 7 ✅
   Failed: 1 ❌
   Success Rate: 87.5%
```

## Troubleshooting

### Problemas Comuns

#### 🐳 Docker não está rodando
```bash
# Iniciar Docker
sudo systemctl start docker
```

#### 📧 Mailpit não está acessível
```bash
# Verificar se container está rodando
docker ps | grep mailpit

# Reiniciar Mailpit
docker restart mailpit
```

#### ⚛️ Next.js não está rodando
```bash
# Iniciar em modo desenvolvimento
npm run dev
```

#### 🗄️ Problemas de banco de dados
```bash
# Aplicar migrações
npm run db:push

# Verificar banco
npm run db:studio
```

### Debug dos Testes

1. **Screenshots**: Verificar `.augment/e2e-tests/screenshots/`
2. **Logs do Browser**: Console errors são exibidos durante execução
3. **Mailpit UI**: Verificar emails em http://localhost:8025
4. **Modo Visual**: Definir `headless: false` para ver browser

## Integração com CI/CD

Para usar em pipelines de CI/CD:

```bash
# Configurar para modo headless
export PUPPETEER_HEADLESS=true

# Executar testes
./scripts/run-e2e-tests.sh
```

## Extensão dos Testes

Para adicionar novos testes:

1. **Criar novo arquivo** em `.augment/e2e-tests/`
2. **Seguir padrão** dos testes existentes
3. **Adicionar ao runner** em `run-all-tests.js`
4. **Documentar** neste arquivo

### Exemplo de Novo Teste

```javascript
async testNewFeature() {
  console.log('\n🧪 Test: New Feature');
  
  try {
    // Implementar teste
    await this.page.goto(`${TEST_CONFIG.baseUrl}/new-feature`);
    await this.takeScreenshot('new-feature-test');
    
    // Verificações
    const element = await this.waitForElement('.new-feature');
    if (!element) {
      throw new Error('New feature not found');
    }
    
    return { success: true, message: 'New feature works correctly' };
    
  } catch (error) {
    await this.takeScreenshot('error-new-feature');
    return { success: false, message: error.message };
  }
}
```

## Manutenção

- **Atualizar screenshots** quando UI mudar
- **Revisar timeouts** se testes ficarem lentos
- **Limpar screenshots antigas** periodicamente
- **Atualizar documentação** quando adicionar novos testes
