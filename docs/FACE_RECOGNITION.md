# Sistema de Reconhecimento Facial

Este documento descreve o sistema de reconhecimento facial implementado no VoxStudent para controle automático de presença.

## 📋 Visão Geral

O sistema permite:
- **Cadastro facial** de estudantes através da webcam
- **Reconhecimento automático** durante o controle de presença
- **Feedback visual e sonoro** para melhor experiência do usuário
- **Fallback manual** sempre disponível

## 🏗️ Arquitetura

### Componentes Principais

#### Frontend
- `FaceCapture.tsx` - Captura e processamento de imagens faciais
- `FaceRecognition.tsx` - Reconhecimento em tempo real
- `FaceRegistration.tsx` - Interface de cadastro facial
- `FeedbackOverlay.tsx` - Sistema de feedback visual
- `audio-feedback.ts` - Sistema de feedback sonoro

#### Backend
- `/api/students/[id]/face-data` - CRUD de dados faciais
- `/api/face-recognition/identify` - Identificação de estudantes
- `/api/face-recognition/mark-attendance` - Marcação automática de presença

#### Banco de Dados
```sql
-- Campos adicionados à tabela students
face_descriptor TEXT,           -- JSON array do descritor facial
photo_url TEXT,                -- URL da foto de referência
face_data_updated_at DATETIME  -- Timestamp da última atualização
```

### Tecnologias Utilizadas

- **face-api.js** - Biblioteca de reconhecimento facial
- **TensorFlow.js** - Machine learning no browser
- **WebRTC** - Acesso à webcam
- **Canvas API** - Processamento de imagens
- **Web Audio API** - Feedback sonoro

## 🚀 Como Usar

### 1. Cadastro Facial

1. Acesse a página de detalhes do estudante
2. Clique em "Cadastrar Face" ou "Atualizar Face"
3. Permita acesso à câmera
4. Posicione o rosto na câmera
5. Aguarde a detecção facial (indicador verde)
6. Clique em "Capturar Rosto"
7. Confirme a captura

### 2. Reconhecimento na Presença

1. Acesse o controle de presença de uma aula
2. Clique em "Reconhecimento Facial"
3. Posicione os estudantes na frente da câmera
4. O sistema reconhecerá automaticamente e marcará presença
5. Confirmação visual e sonora para cada reconhecimento

## 🔧 Configuração Técnica

### Modelos de ML

Os seguintes modelos são baixados automaticamente:
- `tiny_face_detector_model` - Detecção facial rápida
- `face_landmark_68_model` - Pontos de referência facial
- `face_recognition_model` - Extração de características
- `ssd_mobilenetv1_model` - Detecção facial precisa

### Parâmetros de Configuração

```typescript
// Opções de detecção facial
FACE_DETECTION_OPTIONS = {
  inputSize: 416,
  scoreThreshold: 0.5
}

// Limiar de correspondência (menor = mais restritivo)
FACE_MATCH_THRESHOLD = 0.6

// Confiança mínima para reconhecimento automático
AUTO_RECOGNITION_THRESHOLD = 0.5
```

### Permissões Necessárias

- **Câmera** - Acesso à webcam para captura
- **Microfone** - Opcional, para feedback sonoro

## 🔒 Segurança e Privacidade

### Proteção de Dados

- **Face descriptors** são vetores numéricos, não imagens
- **Dados biométricos** são criptografados no banco
- **Processamento local** - reconhecimento no browser
- **Logs de auditoria** para todas as operações

### Conformidade LGPD

- Consentimento explícito para captura facial
- Direito de exclusão dos dados biométricos
- Transparência no processamento
- Minimização de dados coletados

## 🧪 Testes

### Testes E2E

Execute os testes automatizados:

```bash
# Executar todos os testes de reconhecimento facial
./scripts/test-face-recognition.sh

# Executar apenas setup do ambiente
./scripts/test-face-recognition.sh --setup-only

# Executar em modo headless (CI)
./scripts/test-face-recognition.sh --headless
```

### Cenários Testados

- ✅ Cadastro facial completo
- ✅ Reconhecimento em tempo real
- ✅ Feedback visual e sonoro
- ✅ Tratamento de erros
- ✅ Performance dos modelos
- ✅ Permissões de câmera

## 📊 Performance

### Métricas Esperadas

- **Carregamento dos modelos**: < 30 segundos
- **Detecção facial**: ~100ms por frame
- **Reconhecimento**: ~200ms por comparação
- **Precisão**: > 95% com boa iluminação

### Otimizações

- Cache de modelos no browser
- Processamento assíncrono
- Redimensionamento inteligente de imagens
- Throttling de detecção

## 🐛 Troubleshooting

### Problemas Comuns

#### Câmera não funciona
- Verificar permissões do browser
- Testar em HTTPS (obrigatório)
- Verificar se câmera não está em uso

#### Reconhecimento impreciso
- Melhorar iluminação
- Posicionar rosto centralmente
- Recadastrar dados faciais
- Ajustar threshold de confiança

#### Modelos não carregam
- Verificar conexão de internet
- Limpar cache do browser
- Verificar arquivos em `/public/models`

### Logs de Debug

```javascript
// Habilitar logs detalhados
localStorage.setItem('face-api-debug', 'true');

// Verificar status dos modelos
console.log(faceapi.nets.tinyFaceDetector.isLoaded);
```

## 🔄 Atualizações Futuras

### Melhorias Planejadas

- [ ] Reconhecimento múltiplo simultâneo
- [ ] Detecção de máscara facial
- [ ] Integração com câmeras IP
- [ ] Dashboard de analytics
- [ ] Exportação de relatórios

### Considerações Técnicas

- Migração para modelos mais recentes
- Suporte a diferentes resoluções
- Otimização para dispositivos móveis
- Integração com sistemas externos

## 📚 Referências

- [face-api.js Documentation](https://github.com/justadudewhohacks/face-api.js)
- [WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [LGPD - Lei Geral de Proteção de Dados](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)

---

**Última Atualização**: Julho 2025  
**Versão**: 1.0  
**Responsável**: LUCIANO BARGMANN
