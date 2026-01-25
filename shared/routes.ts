import { z } from 'zod';
import { 
  insertSubjectSchema, 
  insertLessonSchema, 
  insertAssignmentSchema,
  subjects,
  lessons,
  assignments
} from './schema';

export { 
  insertSubjectSchema, 
  insertLessonSchema, 
  insertAssignmentSchema 
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
      input: insertSubjectSchema,
      responses: {
        201: z.custom<typeof subjects.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/subjects/:id',
      input: insertSubjectSchema.partial(),
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
