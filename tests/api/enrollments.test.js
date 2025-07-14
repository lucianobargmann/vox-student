const { test, expect } = require('@playwright/test');

// Helper function to get auth token
async function getAuthToken(request) {
  // In a real scenario, you would implement proper authentication
  // For now, we'll mock this
  return 'mock-auth-token';
}

// Helper function to create test data
async function createTestData(request, authToken) {
  // Create a course
  const courseResponse = await request.post('/api/courses', {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    data: {
      name: 'Curso de Teste API',
      allowsMakeup: true
    }
  });
  const course = await courseResponse.json();

  // Create a class
  const classResponse = await request.post('/api/classes', {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    data: {
      courseId: course.data.id,
      name: 'Turma de Teste API',
      startDate: '2024-01-15T00:00:00.000Z',
      maxStudents: 20
    }
  });
  const classData = await classResponse.json();

  // Create a student
  const studentResponse = await request.post('/api/students', {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    data: {
      name: 'Aluno de Teste API',
      email: 'teste.api@example.com',
      phone: '(11) 99999-9999'
    }
  });
  const student = await studentResponse.json();

  return {
    course: course.data,
    class: classData.data,
    student: student.data
  };
}

test.describe('Enrollments API', () => {
  let authToken;
  let testData;

  test.beforeAll(async ({ request }) => {
    authToken = await getAuthToken(request);
    testData = await createTestData(request, authToken);
  });

  test('should create a new enrollment', async ({ request }) => {
    const response = await request.post('/api/enrollments', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        studentId: testData.student.id,
        courseId: testData.course.id,
        classId: testData.class.id,
        type: 'regular',
        notes: 'Matrícula via teste de API'
      }
    });

    expect(response.status()).toBe(201);
    const result = await response.json();
    
    expect(result.data).toHaveProperty('id');
    expect(result.data.studentId).toBe(testData.student.id);
    expect(result.data.courseId).toBe(testData.course.id);
    expect(result.data.classId).toBe(testData.class.id);
    expect(result.data.type).toBe('regular');
    expect(result.data.status).toBe('active');
    expect(result.data.absenceCount).toBe(0);
    
    // Store enrollment ID for other tests
    testData.enrollment = result.data;
  });

  test('should get enrollments list', async ({ request }) => {
    const response = await request.get('/api/enrollments', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();
    
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    
    const enrollment = result.data[0];
    expect(enrollment).toHaveProperty('id');
    expect(enrollment).toHaveProperty('student');
    expect(enrollment).toHaveProperty('course');
    expect(enrollment).toHaveProperty('class');
  });

  test('should filter enrollments by student', async ({ request }) => {
    const response = await request.get(`/api/enrollments?studentId=${testData.student.id}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();
    
    expect(Array.isArray(result.data)).toBe(true);
    result.data.forEach(enrollment => {
      expect(enrollment.studentId).toBe(testData.student.id);
    });
  });

  test('should filter enrollments by class', async ({ request }) => {
    const response = await request.get(`/api/enrollments?classId=${testData.class.id}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();
    
    expect(Array.isArray(result.data)).toBe(true);
    result.data.forEach(enrollment => {
      expect(enrollment.classId).toBe(testData.class.id);
    });
  });

  test('should get specific enrollment', async ({ request }) => {
    const response = await request.get(`/api/enrollments/${testData.enrollment.id}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();
    
    expect(result.data.id).toBe(testData.enrollment.id);
    expect(result.data).toHaveProperty('student');
    expect(result.data).toHaveProperty('course');
    expect(result.data).toHaveProperty('class');
  });

  test('should update enrollment status', async ({ request }) => {
    const response = await request.put(`/api/enrollments/${testData.enrollment.id}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        status: 'inactive',
        notes: 'Inativado via teste de API'
      }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();
    
    expect(result.data.status).toBe('inactive');
    expect(result.data.inactivatedAt).toBeTruthy();
  });

  test('should update absence count and auto-inactivate', async ({ request }) => {
    // First reactivate the enrollment
    await request.put(`/api/enrollments/${testData.enrollment.id}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        status: 'active'
      }
    });

    // Update absence count to 3 (should auto-inactivate)
    const response = await request.put(`/api/enrollments/${testData.enrollment.id}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        absenceCount: 3
      }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();
    
    expect(result.data.absenceCount).toBe(3);
    expect(result.data.status).toBe('inactive');
    expect(result.data.inactivatedAt).toBeTruthy();
  });

  test('should reactivate enrollment', async ({ request }) => {
    const response = await request.post(`/api/enrollments/${testData.enrollment.id}/reactivate`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        resetAbsences: true,
        notes: 'Reativado via teste de API'
      }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();
    
    expect(result.data.status).toBe('active');
    expect(result.data.reactivatedAt).toBeTruthy();
    expect(result.data.absenceCount).toBe(0); // Should be reset
  });

  test('should transfer student between classes', async ({ request }) => {
    // Create another class for transfer
    const newClassResponse = await request.post('/api/classes', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        courseId: testData.course.id,
        name: 'Turma de Destino API',
        startDate: '2024-02-15T00:00:00.000Z',
        maxStudents: 20
      }
    });
    const newClass = await newClassResponse.json();

    const response = await request.post('/api/enrollments/transfer', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        enrollmentId: testData.enrollment.id,
        newClassId: newClass.data.id,
        transferType: 'restart',
        notes: 'Transferência via teste de API'
      }
    });

    expect(response.status()).toBe(201);
    const result = await response.json();
    
    expect(result.data.originalEnrollment.status).toBe('transferred');
    expect(result.data.newEnrollment.classId).toBe(newClass.data.id);
    expect(result.data.newEnrollment.type).toBe('restart');
    expect(result.data.newEnrollment.transferredFromId).toBe(testData.enrollment.id);
    expect(result.data.newEnrollment.absenceCount).toBe(0); // Should be reset for restart
  });

  test('should validate enrollment creation', async ({ request }) => {
    // Test missing studentId
    let response = await request.post('/api/enrollments', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        courseId: testData.course.id,
        classId: testData.class.id,
        type: 'regular'
      }
    });

    expect(response.status()).toBe(400);
    let result = await response.json();
    expect(result.error).toContain('ID do aluno é obrigatório');

    // Test missing courseId
    response = await request.post('/api/enrollments', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        studentId: testData.student.id,
        classId: testData.class.id,
        type: 'regular'
      }
    });

    expect(response.status()).toBe(400);
    result = await response.json();
    expect(result.error).toContain('ID do curso é obrigatório');
  });

  test('should prevent duplicate enrollments', async ({ request }) => {
    // Try to create duplicate enrollment
    const response = await request.post('/api/enrollments', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        studentId: testData.student.id,
        courseId: testData.course.id,
        classId: testData.class.id,
        type: 'regular'
      }
    });

    expect(response.status()).toBe(400);
    const result = await response.json();
    expect(result.error).toContain('já está matriculado');
  });

  test('should handle non-existent enrollment', async ({ request }) => {
    const response = await request.get('/api/enrollments/non-existent-id', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(response.status()).toBe(404);
    const result = await response.json();
    expect(result.error).toContain('não encontrada');
  });

  test('should update absence counts automatically', async ({ request }) => {
    const response = await request.post('/api/enrollments/update-absences', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        classId: testData.class.id
      }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();
    
    expect(result.data).toHaveProperty('updated');
    expect(result.data).toHaveProperty('errors');
    expect(result.data).toHaveProperty('summary');
    expect(Array.isArray(result.data.updated)).toBe(true);
    expect(Array.isArray(result.data.errors)).toBe(true);
  });
});
