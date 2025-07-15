# Arquivos de Som para Reconhecimento Facial

## 📁 Estrutura de Arquivos

Coloque seus arquivos de som nesta pasta com os seguintes nomes:

### 🔊 Arquivos Necessários:

- **`success.mp3`** - Som tocado quando um aluno é reconhecido com sucesso
- **`error.mp3`** - Som tocado quando um rosto é detectado mas não reconhecido  
- **`detection.mp3`** - Som tocado quando um rosto é detectado (opcional)
- **`recognition.mp3`** - Som alternativo para reconhecimento (pode ser igual ao success)

### 📋 Especificações Recomendadas:

- **Formato**: MP3, WAV, ou OGG
- **Duração**: 0.5 - 2 segundos
- **Volume**: Moderado (o sistema ajusta para 50%)
- **Qualidade**: 44.1kHz, 16-bit mínimo

### 🎵 Sugestões de Sons:

- **Success**: Som alegre, ascendente (ding, chime, success beep)
- **Error**: Som grave, descendente (buzz, error tone, negative beep)
- **Detection**: Som neutro, curto (click, pop, neutral beep)
- **Recognition**: Som positivo, distintivo (double beep, confirmation tone)

### 🔄 Fallback:

Se os arquivos não estiverem disponíveis, o sistema usará tons sintéticos como backup.

### 🧪 Como Testar:

1. Coloque os arquivos nesta pasta
2. Recarregue a página de presença
3. Teste o reconhecimento facial
4. Os sons devem tocar automaticamente

---

**Última atualização**: Julho 2025
