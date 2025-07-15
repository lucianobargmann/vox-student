# Implementação da Geração Automática de Aulas

## Problema Identificado

O calendário de aulas estava vazio porque as lessons (aulas) só eram geradas automaticamente quando uma turma era **criada** e o curso já tinha `numberOfLessons` definido. Se uma turma foi criada antes do curso ter esse campo definido, ou se o curso foi editado posteriormente, as lessons não eram geradas.

## Solução Implementada

### 1. Geração Automática na Edição de Turmas

**Arquivo modificado:** `src/app/api/classes/[id]/route.ts`

- Adicionada importação da função `generateLessonsForClass`
- Modificada a consulta do `oldClass` para incluir informações do curso e lessons existentes
- Adicionada lógica para gerar lessons automaticamente quando:
  - A turma não possui lessons (`oldClass.lessons.length === 0`)
  - O curso tem `numberOfLessons` definido e maior que 0
  - A turma está sendo editada

### 2. Nova Função Utilitária

**Arquivo modificado:** `src/lib/lesson-utils.ts`

Adicionada a função `ensureLessonsForClass`:
- Verifica se uma turma precisa de lessons geradas
- Gera lessons automaticamente se necessário
- Retorna `true` se lessons foram geradas, `false` caso contrário

### 3. Novo Endpoint para Geração Manual

**Arquivo criado:** `src/app/api/classes/[id]/generate-lessons/route.ts`

Endpoint POST que permite:
- Gerar lessons para turmas sem lessons existentes
- Regenerar lessons (com `force: true`) mesmo quando já existem
- Validações de segurança (curso deve ter `numberOfLessons` definido)
- Log de auditoria das ações

### 4. Interface Melhorada no Frontend

**Arquivo modificado:** `src/components/LessonCalendar.tsx`

Melhorias na interface:
- Botão "Gerar Aulas" quando não há lessons
- Botão "Regenerar" quando já existem lessons
- Estados de loading durante a geração
- Mensagens de feedback com toast notifications
- Layout melhorado do cabeçalho do calendário

## Como Funciona

### Geração Automática

1. **Na criação de turmas:** Se o curso tem `numberOfLessons` definido, as lessons são geradas automaticamente
2. **Na edição de turmas:** Se a turma não tem lessons e o curso tem `numberOfLessons`, as lessons são geradas automaticamente

### Geração Manual

1. **Botão "Gerar Aulas":** Aparece quando não há lessons na turma
2. **Botão "Regenerar":** Aparece quando já existem lessons, permite regenerar todas as lessons

### Lógica de Geração

As lessons são geradas com base em:
- **Data de início:** Data de início da turma
- **Número de aulas:** Campo `numberOfLessons` do curso
- **Horário:** Campo `classTime` da turma (padrão: 19:00)
- **Frequência:** Semanal (mesmo dia da semana da data de início)

Cada lesson gerada tem:
- Título: "Aula 1", "Aula 2", etc.
- Descrição: "Aula X da turma"
- Data agendada: Data de início + (X-1) semanas
- Duração: 120 minutos (padrão)
- Status: Não concluída

## Validações e Segurança

- Verificação de autenticação em todos os endpoints
- Validação de existência da turma
- Validação de que o curso tem `numberOfLessons` definido
- Proteção contra geração duplicada (sem `force`)
- Log de auditoria de todas as ações

## Testes

Criado teste e2e (`tests/lesson-generation.spec.ts`) que verifica:
- Exibição do botão "Gerar Aulas" quando não há lessons
- Exibição do botão "Regenerar" quando há lessons
- Funcionamento da geração de lessons
- Exibição correta das informações das lessons

## Benefícios

1. **Resolução do problema:** Calendário não fica mais vazio
2. **Flexibilidade:** Permite geração manual e automática
3. **Segurança:** Validações e logs de auditoria
4. **UX melhorada:** Interface intuitiva com feedback visual
5. **Manutenibilidade:** Código bem estruturado e testado

## Uso

### Para Administradores

1. **Criação de turma:** Se o curso já tem número de aulas definido, as lessons são geradas automaticamente
2. **Edição de turma:** Se não há lessons, elas são geradas automaticamente ao salvar
3. **Geração manual:** Use o botão "Gerar Aulas" no calendário
4. **Regeneração:** Use o botão "Regenerar" para recriar todas as lessons

### Para Desenvolvedores

```typescript
// Gerar lessons automaticamente
import { ensureLessonsForClass } from '@/lib/lesson-utils';
const lessonsGenerated = await ensureLessonsForClass(classId);

// Gerar lessons manualmente
import { generateLessonsForClass } from '@/lib/lesson-utils';
await generateLessonsForClass({
  classId,
  startDate: new Date(),
  numberOfLessons: 10,
  classTime: '19:00'
});
```
