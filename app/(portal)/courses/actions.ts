'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import {
  createCourse,
  updateCourse,
  deleteCourse,
  createLesson,
  updateLesson,
  deleteLesson,
  moveLesson,
} from '@/lib/courses/repo'

// ---- Courses -----------------------------------------------------------

export async function createCourseAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const title = String(formData.get('title') ?? '').trim()
  if (!title) return
  const description = String(formData.get('description') ?? '').trim()
  const coverImage = String(formData.get('coverImage') ?? '').trim()
  // owner_id is the AUTHED user — never a posted field.
  await createCourse(user.id, { title, description, coverImage })
  revalidatePath('/courses')
}

export async function updateCourseAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const title = String(formData.get('title') ?? '').trim()
  if (!title) return
  const description = String(formData.get('description') ?? '').trim()
  const coverImage = String(formData.get('coverImage') ?? '').trim()
  const published = String(formData.get('published') ?? '') === 'on'
  await updateCourse(id, { title, description, coverImage, published })
  revalidatePath('/courses')
  revalidatePath(`/courses/${id}`)
}

export async function deleteCourseAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await deleteCourse(id)
  revalidatePath('/courses')
  redirect('/courses')
}

// ---- Lessons -----------------------------------------------------------

export async function createLessonAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const courseId = String(formData.get('courseId') ?? '')
  if (!courseId) return
  const title = String(formData.get('title') ?? '').trim()
  if (!title) return
  const body = String(formData.get('body') ?? '').trim()
  const videoUrl = String(formData.get('videoUrl') ?? '').trim()
  // owner_id is the AUTHED user — never a posted field.
  await createLesson(user.id, courseId, { title, body, videoUrl })
  revalidatePath(`/courses/${courseId}`)
}

export async function updateLessonAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(formData.get('id') ?? '')
  const courseId = String(formData.get('courseId') ?? '')
  if (!id) return
  const title = String(formData.get('title') ?? '').trim()
  if (!title) return
  const body = String(formData.get('body') ?? '').trim()
  const videoUrl = String(formData.get('videoUrl') ?? '').trim()
  await updateLesson(id, { title, body, videoUrl })
  revalidatePath(`/courses/${courseId}`)
}

export async function deleteLessonAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(formData.get('id') ?? '')
  const courseId = String(formData.get('courseId') ?? '')
  if (!id) return
  await deleteLesson(id)
  revalidatePath(`/courses/${courseId}`)
}

export async function moveLessonAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(formData.get('id') ?? '')
  const courseId = String(formData.get('courseId') ?? '')
  const dir = String(formData.get('dir') ?? '') === 'up' ? 'up' : 'down'
  if (!id) return
  await moveLesson(id, dir)
  revalidatePath(`/courses/${courseId}`)
}
