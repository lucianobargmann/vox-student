import { prisma } from './prisma';

export interface LessonGenerationParams {
  classId: string;
  startDate: Date;
  numberOfLessons: number;
  classTime: string;
}

/**
 * Generate lessons for a class based on start date and number of lessons
 * Lessons are created weekly on the same day of the week as the start date
 */
export async function generateLessonsForClass({
  classId,
  startDate,
  numberOfLessons,
  classTime
}: LessonGenerationParams) {
  if (!numberOfLessons || numberOfLessons <= 0) {
    return [];
  }

  const lessons = [];

  // Create a local date to avoid timezone issues
  const localStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const dayOfWeek = localStartDate.getDay(); // 0 = Sunday, 1 = Monday, etc.

  for (let i = 0; i < numberOfLessons; i++) {
    // Calculate the date for this lesson (start date + i weeks)
    const lessonDate = new Date(localStartDate);
    lessonDate.setDate(localStartDate.getDate() + (i * 7));

    // Set the time for the lesson
    const [hours, minutes] = classTime.split(':').map(Number);
    lessonDate.setHours(hours, minutes, 0, 0);

    lessons.push({
      classId,
      title: `Aula ${i + 1}`,
      description: `Aula ${i + 1} da turma`,
      scheduledDate: lessonDate,
      duration: 120, // Default 2 hours
      location: null,
      isCompleted: false,
      notes: null
    });
  }

  // Create all lessons in the database
  const createdLessons = await prisma.lesson.createMany({
    data: lessons
  });

  return createdLessons;
}

/**
 * Delete all lessons for a class
 */
export async function deleteLessonsForClass(classId: string) {
  return await prisma.lesson.deleteMany({
    where: { classId }
  });
}

/**
 * Regenerate lessons for a class
 * This will delete existing lessons and create new ones
 */
export async function regenerateLessonsForClass(params: LessonGenerationParams) {
  // Delete existing lessons
  await deleteLessonsForClass(params.classId);
  
  // Generate new lessons
  return await generateLessonsForClass(params);
}

/**
 * Get lessons for a class with attendance counts
 */
export async function getLessonsWithAttendance(classId: string) {
  return await prisma.lesson.findMany({
    where: { classId },
    include: {
      attendance: {
        include: {
          student: {
            select: {
              id: true,
              name: true
            }
          }
        }
      },
      _count: {
        select: {
          attendance: {
            where: {
              status: 'present'
            }
          }
        }
      }
    },
    orderBy: { scheduledDate: 'asc' }
  });
}

/**
 * Mark a lesson as completed
 */
export async function markLessonCompleted(lessonId: string, completed: boolean = true) {
  return await prisma.lesson.update({
    where: { id: lessonId },
    data: { isCompleted: completed }
  });
}

/**
 * Get lessons for today across all classes
 */
export async function getTodaysLessons() {
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  return await prisma.lesson.findMany({
    where: {
      scheduledDate: {
        gte: startOfDay,
        lte: endOfDay
      }
    },
    include: {
      class: {
        include: {
          course: {
            select: {
              id: true,
              name: true
            }
          },
          enrollments: {
            where: {
              status: 'active'
            },
            include: {
              student: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                  faceDescriptor: true,
                  photoUrl: true,
                  faceDataUpdatedAt: true
                }
              }
            }
          }
        }
      },
      attendance: {
        include: {
          student: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    },
    orderBy: { scheduledDate: 'asc' }
  });
}

/**
 * Check if a class needs lessons generated and generate them if needed
 * This function checks if the class has no lessons and the course has numberOfLessons defined
 */
export async function ensureLessonsForClass(classId: string) {
  // Get class with course and existing lessons
  const classData = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      course: {
        select: {
          numberOfLessons: true
        }
      },
      lessons: true
    }
  });

  if (!classData) {
    throw new Error('Turma não encontrada');
  }

  // Generate lessons if the class has no lessons and the course has numberOfLessons defined
  if (classData.lessons.length === 0 &&
      classData.course.numberOfLessons &&
      classData.course.numberOfLessons > 0) {

    // Create a proper local date from the stored date
    const localStartDate = new Date(classData.startDate.getFullYear(), classData.startDate.getMonth(), classData.startDate.getDate());

    await generateLessonsForClass({
      classId: classData.id,
      startDate: localStartDate,
      numberOfLessons: classData.course.numberOfLessons,
      classTime: classData.classTime || '19:00'
    });

    return true; // Lessons were generated
  }

  return false; // No lessons were generated
}
