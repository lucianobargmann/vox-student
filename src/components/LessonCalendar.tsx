'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Users, CheckCircle, Circle, MoreHorizontal, Plus, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Lesson {
  id: string;
  title: string;
  description?: string;
  scheduledDate: string;
  duration?: number;
  location?: string;
  isCompleted: boolean;
  notes?: string;
  attendance: Array<{
    id: string;
    status: 'present' | 'absent' | 'makeup';
    student: {
      id: string;
      name: string;
    };
  }>;
  _count?: {
    attendance: number;
  };
}

interface LessonCalendarProps {
  classId: string;
  className: string;
  onAttendanceClick?: (lessonId: string) => void;
}

export function LessonCalendar({ classId, className, onAttendanceClick }: LessonCalendarProps) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingLessons, setGeneratingLessons] = useState(false);

  useEffect(() => {
    loadLessons();
  }, [classId]);

  const loadLessons = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        toast.error('Sessão expirada. Faça login novamente.');
        return;
      }

      const response = await fetch(`/api/lessons?classId=${classId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Falha ao carregar aulas');
      }

      const result = await response.json();
      setLessons(result.data || []);
    } catch (error) {
      console.error('Error loading lessons:', error);
      toast.error('Erro ao carregar aulas');
    } finally {
      setLoading(false);
    }
  };

  const toggleLessonCompleted = async (lessonId: string, completed: boolean) => {
    try {
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        toast.error('Sessão expirada. Faça login novamente.');
        return;
      }

      const lesson = lessons.find(l => l.id === lessonId);
      if (!lesson) return;

      const response = await fetch(`/api/lessons/${lessonId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: lesson.title,
          description: lesson.description,
          scheduledDate: lesson.scheduledDate,
          duration: lesson.duration,
          location: lesson.location,
          isCompleted: completed,
          notes: lesson.notes
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao atualizar aula');
      }

      // Update local state
      setLessons(prev => prev.map(l => 
        l.id === lessonId ? { ...l, isCompleted: completed } : l
      ));

      toast.success(completed ? 'Aula marcada como concluída' : 'Aula marcada como pendente');
    } catch (error) {
      console.error('Error updating lesson:', error);
      toast.error('Erro ao atualizar aula');
    }
  };

  const getAttendanceStats = (lesson: Lesson) => {
    const present = lesson.attendance.filter(a => a.status === 'present').length;
    const absent = lesson.attendance.filter(a => a.status === 'absent').length;
    const makeup = lesson.attendance.filter(a => a.status === 'makeup').length;
    const total = lesson.attendance.length;

    return { present, absent, makeup, total };
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
  };

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), "HH:mm", { locale: ptBR });
  };

  const formatDayOfWeek = (dateString: string) => {
    return format(new Date(dateString), "EEEE", { locale: ptBR });
  };

  const generateLessons = async (force: boolean = false) => {
    try {
      setGeneratingLessons(true);
      const token = localStorage.getItem('auth_token');

      if (!token) {
        toast.error('Sessão expirada. Faça login novamente.');
        return;
      }

      const response = await fetch(`/api/classes/${classId}/generate-lessons`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ force })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Falha ao gerar aulas');
      }

      toast.success(result.message);

      // Reload lessons after generation
      await loadLessons();
    } catch (error: any) {
      console.error('Error generating lessons:', error);
      toast.error(error.message || 'Erro ao gerar aulas');
    } finally {
      setGeneratingLessons(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Calendário de Aulas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando aulas...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Calendário de Aulas
          </div>
          {lessons.length > 0 && (
            <Button
              onClick={() => generateLessons(true)}
              disabled={generatingLessons}
              variant="outline"
              size="sm"
            >
              {generatingLessons ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Regenerar
            </Button>
          )}
        </CardTitle>
        <CardDescription>
          {lessons.length} aulas programadas para {className}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {lessons.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma aula encontrada</h3>
            <p className="text-muted-foreground mb-4">
              As aulas podem ser geradas automaticamente baseadas no curso.
            </p>
            <Button
              onClick={() => generateLessons(false)}
              disabled={generatingLessons}
              className="mx-auto"
            >
              {generatingLessons ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Gerar Aulas
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {lessons.map((lesson) => {
              const stats = getAttendanceStats(lesson);
              const isToday = format(new Date(), 'yyyy-MM-dd') === format(new Date(lesson.scheduledDate), 'yyyy-MM-dd');
              const isPast = new Date(lesson.scheduledDate) < new Date();

              return (
                <div
                  key={lesson.id}
                  data-testid="lesson-item"
                  className={`border rounded-lg p-4 ${
                    isToday ? 'border-primary bg-primary/5' :
                    lesson.isCompleted ? 'border-green-200 bg-green-50' :
                    isPast ? 'border-orange-200 bg-orange-50' :
                    'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-semibold">{lesson.title}</h4>
                        {lesson.isCompleted ? (
                          <Badge variant="success" className="flex items-center">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Concluída
                          </Badge>
                        ) : isPast ? (
                          <Badge variant="destructive" className="flex items-center">
                            <Circle className="w-3 h-3 mr-1" />
                            Pendente
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            Agendada
                          </Badge>
                        )}
                        {isToday && (
                          <Badge variant="default">Hoje</Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-2">
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {formatDayOfWeek(lesson.scheduledDate)}, {formatDate(lesson.scheduledDate)}
                        </span>
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {formatTime(lesson.scheduledDate)}
                        </span>
                        {lesson.duration && (
                          <span>{lesson.duration} min</span>
                        )}
                      </div>

                      <div className="flex items-center space-x-4 text-sm">
                        <span className="flex items-center text-green-600">
                          <Users className="w-4 h-4 mr-1" />
                          {stats.present} presentes
                        </span>
                        {stats.absent > 0 && (
                          <span className="text-red-600">{stats.absent} ausentes</span>
                        )}
                        {stats.makeup > 0 && (
                          <span className="text-blue-600">{stats.makeup} reposição</span>
                        )}
                      </div>

                      {lesson.description && (
                        <p className="text-sm text-muted-foreground mt-2">{lesson.description}</p>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {onAttendanceClick && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onAttendanceClick(lesson.id)}
                        >
                          <Users className="w-4 h-4 mr-1" />
                          Presença
                        </Button>
                      )}
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => toggleLessonCompleted(lesson.id, !lesson.isCompleted)}
                          >
                            {lesson.isCompleted ? 'Marcar como pendente' : 'Marcar como concluída'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
