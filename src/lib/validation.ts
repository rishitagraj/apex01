import { z } from 'zod'

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50),
  email: z.string().trim().email('Enter a valid email').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-zA-Z]/, 'Password must contain a letter')
    .regex(/[0-9]/, 'Password must contain a number'),
})

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
})

export const todoSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  dueDate: z
    .union([
      z.string().date('Invalid date'),
      z.string().datetime({ offset: true }),
      z.literal(''),
    ])
    .nullable()
    .optional(),
})

export const meetingSchema = z.object({
  name: z.string().trim().min(1, 'Room name is required').max(100),
})

export const assessmentSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required').max(80),
  title: z.string().trim().min(1, 'Assessment title is required').max(200),
  type: z.enum(['EXAM', 'QUIZ', 'ASSIGNMENT', 'PROJECT', 'OTHER']),
  dueDate: z
    .union([
      z.string().date('Invalid date'),
      z.string().datetime({ offset: true }),
      z.literal(''),
    ])
    .nullable()
    .optional(),
  weight: z.number().int().min(0).max(500).nullable().optional(),
  status: z.enum(['PLANNED', 'STUDYING', 'READY', 'DONE']),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
})

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/

export const timetableDaySchema = z.object({
  name: z.string().trim().min(1, 'Day name is required').max(60),
  sortOrder: z.number().int().min(0).optional(),
})

export const timetableSlotSchema = z
  .object({
    subject: z.string().trim().min(1, 'Subject is required').max(120),
    startAt: z.string().regex(timePattern, 'Use 24-hour HH:MM format'),
    endAt: z.string().regex(timePattern, 'Use 24-hour HH:MM format'),
    notes: z.string().trim().max(1000).optional().or(z.literal('')),
    sortOrder: z.number().int().min(0).optional(),
  })
  .refine((d) => !d.startAt || !d.endAt || d.endAt > d.startAt, {
    message: 'End time must be after start time',
    path: ['endAt'],
  })

export type TodoInput = z.infer<typeof todoSchema>
export type MeetingInput = z.infer<typeof meetingSchema>
export type AssessmentInput = z.infer<typeof assessmentSchema>
export type TimetableDayInput = z.infer<typeof timetableDaySchema>
export type TimetableSlotInput = z.infer<typeof timetableSlotSchema>