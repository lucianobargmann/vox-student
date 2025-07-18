# VoxStudent - Deploy para Produção

Este documento descreve como fazer o deploy da aplicação VoxStudent para produção usando Docker.

## Pré-requisitos

1. **Docker** instalado na máquina local
2. **SSH access** para o servidor de produção
3. **Chave SSH** configurada (`~/.ssh/hunt-luke-2025.pem`)
4. **Servidor** com Ubuntu/Debian

## Arquivos de Deploy

- `Dockerfile` - Configuração do container da aplicação
- `docker-compose.yml` - Orquestração dos serviços
- `.env.production` - Variáveis de ambiente para produção
- `deploy.sh` - Script principal de deploy
- `server-setup.sh` - Script de configuração inicial do servidor
- `nginx.conf` - Configuração do proxy reverso (opcional)

## Configuração Inicial

### 1. Configurar Variáveis de Ambiente

Edite o arquivo `.env.production` com suas configurações:

```bash
# Database
DATABASE_URL="file:./prod.db"

# JWT Secret (MUDE PARA UM VALOR SEGURO)
JWT_SECRET="sua-chave-jwt-super-secreta-para-producao"

# Email Configuration
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="seu-email@gmail.com"
SMTP_PASS="sua-senha-de-app"
SMTP_FROM_EMAIL="noreply@voxstudent.com"
SMTP_FROM_NAME="VoxStudent"

# Application
APP_URL="https://vox-student.hcktplanet.com"
NODE_ENV="production"

# Admin Configuration
SUPER_ADMIN_EMAIL="luciano@hcktplanet.com"
ADMIN_EMAILS="admin@voxstudent.com"
```

### 2. Configurar Servidor (Primeira vez apenas)

Execute o script de setup do servidor:

```bash
./server-setup.sh
```

Este script irá:
- Instalar Docker e Docker Compose
- Configurar firewall
- Criar serviço systemd
- Configurar monitoramento automático

## Deploy

### Deploy Completo

Para fazer o deploy da aplicação:

```bash
./deploy.sh
```

Este script irá:
1. Construir a imagem Docker
2. Transferir para o servidor
3. Atualizar o docker-compose.yml
4. Fazer o deploy da aplicação

### Deploy Manual

Se preferir fazer o deploy manualmente:

```bash
# 1. Build da imagem
docker build -t lucianobargmann/vox-student:latest .

# 2. Transferir para servidor
docker save lucianobargmann/vox-student:latest | bzip2 | ssh -i ~/.ssh/hunt-luke-2025.pem root@164.163.10.235 'bunzip2 | docker load'

# 3. Deploy no servidor
ssh -i ~/.ssh/hunt-luke-2025.pem root@164.163.10.235 'cd /opt/voxstudent && docker-compose up -d'
```

## Monitoramento

### Verificar Status

```bash
ssh -i ~/.ssh/hunt-luke-2025.pem root@164.163.10.235 'cd /opt/voxstudent && docker-compose ps'
```

### Ver Logs

```bash
ssh -i ~/.ssh/hunt-luke-2025.pem root@164.163.10.235 'cd /opt/voxstudent && docker-compose logs -f'
```

### Health Check

A aplicação possui um endpoint de health check em `/api/health` que verifica:
- Status da aplicação
- Conexão com banco de dados
- Uptime do processo

## Estrutura no Servidor

```
/opt/voxstudent/
├── docker-compose.yml
├── .env.production
├── data/                 # Banco de dados SQLite
├── whatsapp-session/     # Sessão do WhatsApp
├── ssl/                  # Certificados SSL (se usar nginx)
└── monitor.sh           # Script de monitoramento
```

## SSL/HTTPS com Traefik

A aplicação está configurada para usar Traefik como proxy reverso com SSL automático:

### Configuração do Traefik

O `docker-compose.yml` inclui labels do Traefik:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.vox-student.rule=Host(`vox-student.hcktplanet.com`)"
  - "traefik.http.routers.vox-student.entrypoints=websecure"
  - "traefik.http.routers.vox-student.tls.certresolver=letsencrypt"
  - "traefik.http.services.vox-student.loadbalancer.server.port=3000"
```

### Pré-requisitos

1. **Traefik** deve estar rodando no servidor
2. **DNS** deve apontar `vox-student.hcktplanet.com` para o servidor
3. **Let's Encrypt** configurado no Traefik para SSL automático

### SSL/HTTPS (Alternativo com nginx)

Para configurar HTTPS com nginx ao invés do Traefik:

1. Coloque os certificados em `/opt/voxstudent/ssl/`
2. Atualize o `nginx.conf` com seu domínio
3. Descomente o serviço nginx no `docker-compose.yml`
4. Remova os labels do Traefik

## Backup

### Backup do Banco de Dados

```bash
ssh -i ~/.ssh/hunt-luke-2025.pem root@164.163.10.235 'cd /opt/voxstudent && cp data/prod.db data/prod.db.backup.$(date +%Y%m%d_%H%M%S)'
```

### Backup da Sessão WhatsApp

```bash
ssh -i ~/.ssh/hunt-luke-2025.pem root@164.163.10.235 'cd /opt/voxstudent && tar -czf whatsapp-session-backup-$(date +%Y%m%d_%H%M%S).tar.gz whatsapp-session/'
```

## Troubleshooting

### Container não inicia

```bash
# Ver logs detalhados
ssh -i ~/.ssh/hunt-luke-2025.pem root@164.163.10.235 'cd /opt/voxstudent && docker-compose logs vox-student'

# Reiniciar serviços
ssh -i ~/.ssh/hunt-luke-2025.pem root@164.163.10.235 'cd /opt/voxstudent && docker-compose restart'
```

### Problemas de permissão

```bash
# Corrigir permissões
ssh -i ~/.ssh/hunt-luke-2025.pem root@164.163.10.235 'chown -R 1001:1001 /opt/voxstudent/data /opt/voxstudent/whatsapp-session'
```

### Atualizar aplicação

Para atualizar apenas a aplicação sem reconfigurar o servidor:

```bash
./deploy.sh
```

## Configurações de Produção

- **Banco de dados**: SQLite em volume persistente
- **Sessão WhatsApp**: Volume persistente para manter sessão ativa
- **Logs**: Rotacionados automaticamente pelo Docker
- **Monitoramento**: Health check a cada 30 segundos
- **Auto-restart**: Containers reiniciam automaticamente em caso de falha
- **Firewall**: Apenas portas 22, 80, 443 e 3000 abertas
- **Systemd**: Serviço configurado para iniciar automaticamente no boot

## URLs de Acesso

- **Aplicação (direto)**: http://164.163.10.235:3000
- **Health Check**: http://164.163.10.235:3000/api/health
- **Com Traefik**: https://vox-student.hcktplanet.com
- **Com nginx**: https://voxstudent.seudominio.com
