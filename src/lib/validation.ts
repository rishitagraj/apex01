import { z } from 'zod'
import { TIMETABLE_MODEL_IDS } from '@/types/timetable'
import { RESOURCE_KINDS } from '@/types/syllabus'
import { RESOURCE_UPLOAD_MAX_BYTES } from '@/lib/resources'

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

const optionalTime = z
  .union([z.string().regex(timePattern, 'Use 24-hour HH:MM format'), z.literal('')])
  .optional()
  .default('')

/** What the user tells the AI timetable planner. */
export const timetableGenerateSchema = z.object({
  model: z.enum(TIMETABLE_MODEL_IDS).default("auto"),
  wakeTime: optionalTime,
  sleepTime: optionalTime,
  schoolStart: optionalTime,
  schoolEnd: optionalTime,
  homeTime: optionalTime,
  days: z.array(z.string().trim().min(1).max(20)).max(7).default([]),
  coaching: z.string().trim().max(500).optional().or(z.literal('')).default(''),
  studyHours: z.number().min(0).max(16).nullable().default(null),
  priorities: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
  description: z.string().trim().max(4000).optional().or(z.literal('')).default(''),
  extra: z.string().trim().max(1500).optional().or(z.literal('')).default(''),
})

const draftSlotSchema = z
  .object({
    subject: z.string().trim().min(1).max(120),
    startAt: z.string().regex(timePattern, 'Use 24-hour HH:MM format'),
    endAt: z.string().regex(timePattern, 'Use 24-hour HH:MM format'),
    notes: z.string().trim().max(1000).optional().or(z.literal('')),
  })
  .refine((d) => d.endAt > d.startAt, {
    message: 'End time must be after start time',
    path: ['endAt'],
  })

/** Persist an (edited) generated draft into the user's timetable. */
export const timetableApplySchema = z.object({
  mode: z.enum(['append', 'replace']).default('append'),
  days: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        slots: z.array(draftSlotSchema).max(40),
      }),
    )
    .min(1)
    .max(10),
})

/** A completed Pomodoro focus session. This is the sole source of focus time. */
export const pomodoroSessionSchema = z.object({
  minutes: z
    .number()
    .int('Session length must be a whole number of minutes')
    .min(1, 'Session must be at least a minute')
    .max(180, 'Session is implausibly long'),
  mode: z.literal('focus').default('focus'),
})

export type TodoInput = z.infer<typeof todoSchema>
export type PomodoroSessionInput = z.infer<typeof pomodoroSessionSchema>
export type TimetableGenerateInput = z.infer<typeof timetableGenerateSchema>
export type TimetableApplyInput = z.infer<typeof timetableApplySchema>
export type MeetingInput = z.infer<typeof meetingSchema>
export type AssessmentInput = z.infer<typeof assessmentSchema>
export type TimetableDayInput = z.infer<typeof timetableDaySchema>
export type TimetableSlotInput = z.infer<typeof timetableSlotSchema>

export const chatMessageSchema = z.object({
  channelId: z.string().cuid('Invalid channel'),
  content: z
    .string()
    .trim()
    .max(2000, 'Message is too long')
    .optional()
    .or(z.literal('')),
  imageKey: z.string().startsWith('chat-images/', 'Invalid image').optional().nullable(),
  imageType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']).optional().nullable(),
}).refine((d) => (d.content ?? '').length > 0 || d.imageKey, {
  message: 'Add a message or an image.',
})

export const chatImageSchema = z.object({
  fileName: z.string().trim().min(1).max(120),
  contentType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  fileSize: z.number().int().min(1).max(10 * 1024 * 1024, 'Image is larger than 10 MB'),
})

export const chatChannelSchema = z.object({
  name: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Channel name must be at least 3 characters')
    .max(32, 'Channel name is too long')
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes'),
})

export type ChatMessageInput = z.infer<typeof chatMessageSchema>
export type ChatChannelInput = z.infer<typeof chatChannelSchema>
export type ChatImageInput = z.infer<typeof chatImageSchema>

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/
const examTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/

export const examTypeValues = [
  'UNIT_TEST',
  'MIDTERM',
  'ANNUAL',
  'QUIZ',
  'CUSTOM',
] as const

export const examSchema = z
  .object({
    name: z.string().trim().min(1, 'Exam name is required').max(200),
    date: z.string().regex(dateOnlyPattern, 'Pick a valid exam date'),
    time: z
      .union([z.string().regex(examTimePattern, 'Use 24-hour HH:MM format'), z.literal('')])
      .nullable()
      .optional(),
    type: z.enum(examTypeValues),
    classLevel: z.string().trim().max(60).optional().or(z.literal('')),
    notes: z.string().trim().max(2000).optional().or(z.literal('')),
    subjectIds: z.array(z.string().min(1)).max(200).default([]),
    chapterIds: z.array(z.string().min(1)).max(2000).default([]),
    conceptIds: z.array(z.string().min(1)).max(10000).default([]),
  })
  .refine((d) => d.chapterIds.length + d.conceptIds.length > 0, {
    message: 'Select at least one chapter or concept.',
    path: ['chapterIds'],
  })

export const examAttemptSchema = z.object({
  attemptDate: z.string().regex(dateOnlyPattern, 'Pick a valid date'),
  marks: z.number().int().min(0).max(100000).nullable().optional(),
  maxMarks: z.number().int().min(0).max(100000).nullable().optional(),
  subjectMarks: z
    .array(
      z.object({
        subjectId: z.string().nullable().optional(),
        name: z.string().trim().min(1).max(120),
        marks: z.number().min(0).max(100000).nullable().optional(),
        maxMarks: z.number().min(0).max(100000).nullable().optional(),
      }),
    )
    .max(60)
    .optional(),
  weakTopics: z.string().trim().max(2000).optional().or(z.literal('')),
  mistakes: z.string().trim().max(2000).optional().or(z.literal('')),
  reflections: z.string().trim().max(2000).optional().or(z.literal('')),
})

export type ExamInput = z.infer<typeof examSchema>
export type ExamAttemptInput = z.infer<typeof examAttemptSchema>

export const resourceFolderSchema = z.object({
  name: z.string().trim().min(1, 'Folder name is required').max(60),
})

const linkLike = z
  .string()
  .trim()
  .min(1, 'Paste a link')
  .max(2000)
  .refine((value) => {
    try {
      const href = /^https?:\/\//i.test(value) ? value : `https://${value}`
      const url = new URL(href)
      return /^https?:$/.test(url.protocol) && url.hostname.includes('.')
    } catch {
      return false
    }
  }, 'Enter a valid link (e.g. https://example.com/page.pdf)')

export const resourceItemSchema = z.object({
  folderId: z.string().min(1).nullable().optional(),
  kind: z.enum(RESOURCE_KINDS).optional(),
  title: z.string().trim().max(200).optional().or(z.literal('')),
  url: linkLike,
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
})

export const resourceUploadPresignSchema = z.object({
  fileName: z.string().trim().min(1, 'Choose a file').max(200),
  contentType: z.string().trim().max(160).optional().or(z.literal('')),
  fileSize: z
    .number()
    .int()
    .min(1, 'The file is empty')
    .max(RESOURCE_UPLOAD_MAX_BYTES, 'Each file must be 25 MB or smaller'),
})

export const resourceUploadCompleteSchema = z.object({
  fileKey: z.string().trim().min(1).max(500),
  fileName: z.string().trim().min(1).max(200),
  contentType: z.string().trim().max(160).optional().or(z.literal('')),
  fileSize: z
    .number()
    .int()
    .min(1)
    .max(RESOURCE_UPLOAD_MAX_BYTES)
    .optional(),
  folderId: z.string().min(1).nullable().optional(),
  title: z.string().trim().max(200).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  uploadId: z.string().trim().min(1).max(500).optional(),
  parts: z
    .array(
      z.object({
        partNumber: z.number().int().min(1).max(10000),
        etag: z.string().trim().min(1).max(200),
      }),
    )
    .max(200)
    .optional(),
})

export const resourceUploadAbortSchema = z.object({
  fileKey: z.string().trim().min(1).max(500),
  uploadId: z.string().trim().min(1).max(500),
})

export type ResourceFolderInput = z.infer<typeof resourceFolderSchema>
export type ResourceItemInput = z.infer<typeof resourceItemSchema>
export type ResourceUploadPresignInput = z.infer<typeof resourceUploadPresignSchema>
export type ResourceUploadCompleteInput = z.infer<typeof resourceUploadCompleteSchema>
export type ResourceUploadAbortInput = z.infer<typeof resourceUploadAbortSchema>