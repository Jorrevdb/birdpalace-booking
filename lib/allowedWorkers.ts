// List of emails allowed to register/link as workers.
// Edit this file to add or remove allowed addresses.
export const ALLOWED_WORKER_EMAILS = [
  'jorre123vdb@gmail.com',
  'bird.palace.pelt@gmail.com',
]

export function isAllowedWorkerEmail(email?: string | null) {
  if (!email) return false
  return ALLOWED_WORKER_EMAILS.includes(email.toLowerCase())
}

export default isAllowedWorkerEmail
