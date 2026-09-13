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

export type TodoInput = z.infer<typeof todoSchema>
export type MeetingInput = z.infer<typeof meetingSchema>