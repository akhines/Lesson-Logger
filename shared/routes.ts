import { z } from 'zod';
import { 
  insertSubjectSchema,
  insertSubjectSchemaWithUser,
  insertLessonSchema, 
  insertAssignmentSchema,
  insertStudentSchema,
  insertLessonResourceSchema,
  insertFormContentSchemaWithUser,
  subjects,
  lessons,
  assignments,
  students,
  lessonResources,
  formContent,
  type InsertAssignment,
  type InsertStudent,
} from './schema';

export { 
  insertSubjectSchema, 
  insertLessonSchema, 
  insertAssignmentSchema,
  insertStudentSchema,
  insertLessonResourceSchema,
  insertFormContentSchema
} from './schema';

export type CreateAssignmentRequest = InsertAssignment;
export type UpdateAssignmentRequest = Partial<InsertAssignment>;

export type CreateStudentRequest = Omit<InsertStudent, 'userId'>;
export type UpdateStudentRequest = Partial<Omit<InsertStudent, 'userId'>>;

export type {
  CreateSubjectRequest,
  UpdateSubjectRequest,
  CreateLessonRequest,
  UpdateLessonRequest
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  students: {
    list: {
      method: 'GET' as const,
      path: '/api/students',
      responses: {
        200: z.array(z.custom<typeof students.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/students/:id',
      responses: {
        200: z.custom<typeof students.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/students',
      input: insertStudentSchema,
      responses: {
        201: z.custom<typeof students.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/students/:id',
      input: insertStudentSchema.partial(),
      responses: {
        200: z.custom<typeof students.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/students/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  subjects: {
    list: {
      method: 'GET' as const,
      path: '/api/subjects',
      responses: {
        200: z.array(z.custom<typeof subjects.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/subjects/:id',
      responses: {
        200: z.custom<typeof subjects.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/subjects',
      input: insertSubjectSchemaWithUser,
      responses: {
        201: z.custom<typeof subjects.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/subjects/:id',
      input: insertSubjectSchemaWithUser.partial(),
      responses: {
        200: z.custom<typeof subjects.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/subjects/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  lessons: {
    list: {
      method: 'GET' as const,
      path: '/api/lessons',
      input: z.object({
        subjectId: z.coerce.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof lessons.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/lessons/:id',
      responses: {
        200: z.custom<typeof lessons.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/lessons',
      input: insertLessonSchema,
      responses: {
        201: z.custom<typeof lessons.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/lessons/:id',
      input: insertLessonSchema.partial(),
      responses: {
        200: z.custom<typeof lessons.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/lessons/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  assignments: {
    list: {
      method: 'GET' as const,
      path: '/api/assignments',
      input: z.object({
        lessonId: z.coerce.number().optional(),
        studentId: z.coerce.number().optional(),
        subjectId: z.coerce.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof assignments.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/assignments/:id',
      responses: {
        200: z.custom<typeof assignments.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/assignments',
      input: insertAssignmentSchema,
      responses: {
        201: z.custom<typeof assignments.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/assignments/:id',
      input: insertAssignmentSchema.partial(),
      responses: {
        200: z.custom<typeof assignments.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/assignments/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  lessonResources: {
    list: {
      method: 'GET' as const,
      path: '/api/lesson-resources',
      input: z.object({
        lessonId: z.coerce.number().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof lessonResources.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/lesson-resources/:id',
      responses: {
        200: z.custom<typeof lessonResources.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/lesson-resources',
      input: insertLessonResourceSchema,
      responses: {
        201: z.custom<typeof lessonResources.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/lesson-resources/:id',
      input: insertLessonResourceSchema.partial(),
      responses: {
        200: z.custom<typeof lessonResources.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/lesson-resources/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  studentAuth: {
    login: {
      method: 'POST' as const,
      path: '/api/student-auth/login',
      input: z.object({
        studentId: z.number(),
        pin: z.string(),
      }),
      responses: {
        200: z.object({
          success: z.boolean(),
          student: z.custom<typeof students.$inferSelect>().optional(),
        }),
        401: errorSchemas.notFound,
      },
    },
  },
  formContent: {
    list: {
      method: 'GET' as const,
      path: '/api/form-content',
      input: z.object({
        formLevel: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof formContent.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/form-content/:id',
      responses: {
        200: z.custom<typeof formContent.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/form-content',
      input: insertFormContentSchemaWithUser,
      responses: {
        201: z.custom<typeof formContent.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/form-content/:id',
      input: insertFormContentSchemaWithUser.partial(),
      responses: {
        200: z.custom<typeof formContent.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/form-content/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
