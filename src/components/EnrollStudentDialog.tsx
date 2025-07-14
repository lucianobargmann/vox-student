'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, UserPlus, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Student {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  enrollments: Array<{
    id: string;
    status: string;
    type: string;
    course: {
      id: string;
      name: string;
    };
    class: {
      id: string;
      name: string;
    } | null;
  }>;
}

interface Course {
  id: string;
  name: string;
  allowsMakeup: boolean;
}

interface Class {
  id: string;
  name: string;
  courseId: string;
  startDate: string;
  endDate: string | null;
  maxStudents: number | null;
  enrollments: Array<{ id: string }>;
}

interface EnrollStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnrollmentCreated: () => void;
  preselectedClassId?: string;
  preselectedCourseId?: string;
}

export function EnrollStudentDialog({
  open,
  onOpenChange,
  onEnrollmentCreated,
  preselectedClassId,
  preselectedCourseId
}: EnrollStudentDialogProps) {
  const [step, setStep] = useState<'student' | 'details'>('student');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState({
    courseId: preselectedCourseId || '',
    classId: preselectedClassId || '',
    type: 'regular' as 'regular' | 'guest' | 'restart',
    notes: ''
  });

  // Load initial data
  useEffect(() => {
    if (open) {
      loadCourses();
      if (searchTerm) {
        searchStudents();
      }
    }
  }, [open, searchTerm]);

  // Load classes when course changes
  useEffect(() => {
    if (formData.courseId) {
      loadClasses(formData.courseId);
    }
  }, [formData.courseId]);

  const loadCourses = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/courses', { headers });
      const result = await response.json();
      if (result.data) {
        setCourses(result.data);
      }
    } catch (error) {
      console.error('Error loading courses:', error);
      toast.error('Erro ao carregar cursos');
    }
  };

  const loadClasses = async (courseId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/classes?courseId=${courseId}`, { headers });
      const result = await response.json();
      if (result.data) {
        setClasses(result.data);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
      toast.error('Erro ao carregar turmas');
    }
  };

  const searchStudents = async () => {
    console.log('🔍 FRONTEND: searchStudents called with searchTerm:', searchTerm);

    if (!searchTerm.trim()) {
      console.log('🔍 FRONTEND: searchTerm is empty, clearing students');
      setStudents([]);
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const url = `/api/students?search=${encodeURIComponent(searchTerm)}`;
      console.log('🔍 FRONTEND: Making request to:', url);
      console.log('🔍 FRONTEND: Headers:', headers);

      const response = await fetch(url, { headers });
      console.log('🔍 FRONTEND: Response status:', response.status);

      const result = await response.json();
      console.log('🔍 FRONTEND: Response data:', result);

      if (result.data) {
        console.log('🔍 FRONTEND: Setting students:', result.data.length, 'students found');
        setStudents(result.data);
      } else {
        console.log('🔍 FRONTEND: No data in response');
        setStudents([]);
      }
    } catch (error) {
      console.error('🔍 FRONTEND: Error searching students:', error);
      toast.error('Erro ao buscar alunos');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student);
    setStep('details');
  };

  const handleEnroll = async () => {
    if (!selectedStudent || !formData.courseId) {
      toast.error('Dados incompletos');
      return;
    }

    try {
      setLoading(true);

      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/enrollments', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          studentId: selectedStudent.id,
          courseId: formData.courseId,
          classId: formData.classId === 'no-class' ? null : formData.classId || null,
          type: formData.type,
          notes: formData.notes.trim() || null
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar matrícula');
      }

      toast.success('Aluno matriculado com sucesso!');
      onEnrollmentCreated();
      handleClose();
    } catch (error) {
      console.error('Error creating enrollment:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao matricular aluno');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('student');
    setSelectedStudent(null);
    setSearchTerm('');
    setStudents([]);
    setFormData({
      courseId: preselectedCourseId || '',
      classId: preselectedClassId || '',
      type: 'regular',
      notes: ''
    });
    onOpenChange(false);
  };

  const getEnrollmentTypeLabel = (type: string) => {
    switch (type) {
      case 'regular': return 'Regular';
      case 'guest': return 'Convidado';
      case 'restart': return 'Reinício';
      default: return type;
    }
  };

  const getEnrollmentTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'regular': return 'default';
      case 'guest': return 'secondary';
      case 'restart': return 'outline';
      default: return 'default';
    }
  };

  const isStudentAlreadyEnrolled = (student: Student) => {
    if (!formData.courseId) return false;
    
    return student.enrollments.some(enrollment => 
      enrollment.course.id === formData.courseId && 
      (enrollment.status === 'active' || enrollment.status === 'inactive') &&
      (!formData.classId || enrollment.class?.id === formData.classId)
    );
  };

  const selectedClass = classes.find(c => c.id === formData.classId);
  const isClassFull = selectedClass && selectedClass.maxStudents && 
    selectedClass.enrollments.length >= selectedClass.maxStudents;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Matricular Aluno
          </DialogTitle>
          <DialogDescription>
            {step === 'student' 
              ? 'Busque e selecione o aluno que deseja matricular'
              : 'Configure os detalhes da matrícula'
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'student' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search">Buscar Aluno</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Digite nome, email ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="ml-2">Buscando alunos...</span>
              </div>
            )}

            {students.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {students.map((student) => {
                  const alreadyEnrolled = isStudentAlreadyEnrolled(student);
                  
                  return (
                    <div
                      key={student.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        alreadyEnrolled 
                          ? 'bg-muted border-muted cursor-not-allowed opacity-60'
                          : 'hover:bg-muted/50 border-border'
                      }`}
                      onClick={() => !alreadyEnrolled && handleStudentSelect(student)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{student.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {student.email && <span>{student.email}</span>}
                            {student.email && student.phone && <span> • </span>}
                            {student.phone && <span>{student.phone}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {alreadyEnrolled && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Já matriculado
                            </Badge>
                          )}
                          <Badge variant={student.status === 'active' ? 'default' : 'secondary'}>
                            {student.status === 'active' ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {searchTerm && !loading && students.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum aluno encontrado para &quot;{searchTerm}&quot;
              </div>
            )}
          </div>
        )}

        {step === 'details' && selectedStudent && (
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <div className="font-medium">{selectedStudent.name}</div>
              <div className="text-sm text-muted-foreground">
                {selectedStudent.email && <span>{selectedStudent.email}</span>}
                {selectedStudent.email && selectedStudent.phone && <span> • </span>}
                {selectedStudent.phone && <span>{selectedStudent.phone}</span>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="course">Curso *</Label>
                <Select
                  value={formData.courseId}
                  onValueChange={(value) => setFormData({ ...formData, courseId: value, classId: '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um curso" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="class">Turma</Label>
                <Select
                  value={formData.classId}
                  onValueChange={(value) => setFormData({ ...formData, classId: value })}
                  disabled={!formData.courseId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma turma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no-class">Sem turma específica</SelectItem>
                    {classes.map((classItem) => (
                      <SelectItem 
                        key={classItem.id} 
                        value={classItem.id}
                        disabled={classItem.maxStudents && classItem.enrollments.length >= classItem.maxStudents}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>{classItem.name}</span>
                          {classItem.maxStudents && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ({classItem.enrollments.length}/{classItem.maxStudents})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isClassFull && (
                  <p className="text-xs text-destructive">Turma lotada</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Tipo de Matrícula</Label>
              <Select
                value={formData.type}
                onValueChange={(value: 'regular' | 'guest' | 'restart') => 
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="default">Regular</Badge>
                        <span>Matrícula normal no curso</span>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="guest">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Convidado</Badge>
                        <span>Aulas de reposição em outra turma</span>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="restart">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Reinício</Badge>
                        <span>Reiniciar curso em nova turma</span>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Observações sobre a matrícula..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'student' ? (
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('student')}>
                Voltar
              </Button>
              <Button 
                onClick={handleEnroll} 
                disabled={loading || !formData.courseId || isClassFull}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Matriculando...
                  </>
                ) : (
                  'Matricular'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
